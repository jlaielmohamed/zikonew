// Supabase Edge Function: create-barber-account
// Only this Edge Function uses the service role key
// Deploy with: supabase functions deploy create-barber-account --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function findUserByEmail(admin: any, email: string) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users || []).find(
    (user: any) => user.email?.toLowerCase() === normalized
  ) || null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if caller is admin
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      throw new Error("Only admins can create barber accounts");
    }

    const { email, password, full_name, phone, barber_id } = await req.json();

    if (!barber_id) {
      throw new Error("Missing barber");
    }

    const { data: barber, error: lookupError } = await supabaseAdmin
      .from("barbers")
      .select("id, profile_id, display_name")
      .eq("id", barber_id)
      .single();

    if (lookupError || !barber) {
      throw new Error("Barber not found");
    }

    let userId = barber.profile_id;

    if (!userId) {
      // No account linked yet. Reuse an existing auth user if the email is
      // already registered, otherwise create one.
      if (!email || !password) {
        throw new Error("Email and password are required for a new barber account");
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await findUserByEmail(supabaseAdmin, normalizedEmail);

      if (existingUser) {
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", existingUser.id)
          .maybeSingle();

        if (existingProfile?.role === "admin") {
          throw new Error(
            "This email is already used by the admin account. Use a different email for the barber."
          );
        }

        const { data: linkedBarber } = await supabaseAdmin
          .from("barbers")
          .select("id")
          .eq("profile_id", existingUser.id)
          .maybeSingle();

        if (linkedBarber && linkedBarber.id !== barber_id) {
          throw new Error("This email is already linked to another barber.");
        }

        userId = existingUser.id;

        if (password) {
          const { error: passwordError } =
            await supabaseAdmin.auth.admin.updateUserById(userId, { password });
          if (passwordError) throw passwordError;
        }
      } else {
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: full_name || barber.display_name },
          });

        if (authError) throw authError;
        userId = authData.user.id;
      }

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: userId,
            role: "barber",
            full_name: full_name || barber.display_name,
            phone: phone || null,
          },
          { onConflict: "id" }
        );

      if (profileError) throw profileError;

      const { error: barberError } = await supabaseAdmin
        .from("barbers")
        .update({ profile_id: userId })
        .eq("id", barber_id);

      if (barberError) throw barberError;
    } else {
      // Account already linked: Ziko can reset the password or change the email.
      const authUpdates: Record<string, string> = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;

      if (Object.keys(authUpdates).length > 0) {
        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
        if (updateError) throw updateError;
      }

      const profileUpdates: Record<string, string> = { id: userId, role: "barber" };
      if (full_name) profileUpdates.full_name = full_name;
      if (phone) profileUpdates.phone = phone;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(profileUpdates, { onConflict: "id" });
      if (profileError) throw profileError;
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
