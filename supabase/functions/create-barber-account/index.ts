// Supabase Edge Function: create-barber-account
// Only this Edge Function uses the service role key
// Deploy with: supabase functions deploy create-barber-account --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (!email || !password || !full_name || !barber_id) {
      throw new Error("Missing required fields");
    }

    // Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (authError) throw authError;

    // Update profile role to barber
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "barber", full_name, phone })
      .eq("id", authData.user.id);

    if (profileError) throw profileError;

    // Link barber profile
    const { error: barberError } = await supabaseAdmin
      .from("barbers")
      .update({ profile_id: authData.user.id })
      .eq("id", barber_id);

    if (barberError) throw barberError;

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user.id }),
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
