import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

const VALID_FORMATS = ["singles", "doubles", "mixed_doubles", "drill"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createUserClient(req);

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DELETE: clear current availability ---

    if (req.method === "DELETE") {
      const { error: deleteError } = await supabase
        .from("available_players")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "available");

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true, message: "Availability cleared" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- POST: set availability ---

    const body = await req.json();
    const { available_until, latitude, longitude, preferred_format } = body;

    // Validate required field
    if (!available_until) {
      return new Response(
        JSON.stringify({ error: "available_until is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate available_until is in the future
    if (new Date(available_until) <= new Date()) {
      return new Response(
        JSON.stringify({ error: "available_until must be in the future" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate preferred_format if provided
    if (preferred_format && !VALID_FORMATS.includes(preferred_format)) {
      return new Response(
        JSON.stringify({
          error: `preferred_format must be one of: ${VALID_FORMATS.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user has a profile
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found. Complete onboarding first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Clear any existing availability first (unique index enforces one active per user,
    // so we delete then insert to act as an upsert)
    await supabase
      .from("available_players")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "available");

    // Build the insert row
    const row: Record<string, unknown> = {
      user_id: user.id,
      status: "available",
      available_until,
    };

    if (preferred_format) row.preferred_format = preferred_format;

    if (latitude != null && longitude != null) {
      row.location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    // Insert new availability
    const { data: availability, error: insertError } = await supabase
      .from("available_players")
      .insert(row)
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, availability }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
