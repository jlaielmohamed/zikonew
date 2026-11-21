// Supabase Edge Function: verify-turnstile
// Checks a Cloudflare Turnstile token with the secret key kept in Supabase secrets.
// Deploy with: supabase functions deploy verify-turnstile --no-verify-jwt

import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    const secret = Deno.env.get("TURNSTILE_SECRET_KEY");

    if (!secret) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing TURNSTILE_SECRET_KEY secret" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // remoteip is intentionally omitted: Supabase can sit behind proxies, so
    // sending a guessed IP could make Cloudflare reject a valid token.
    const form = new URLSearchParams({ secret, response: token });

    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }
    );

    const result = await verifyResponse.json();

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: "captcha_failed", codes: result["error-codes"] || [] }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
