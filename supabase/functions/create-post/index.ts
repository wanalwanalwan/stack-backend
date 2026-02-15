import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

const VALID_POST_TYPES = ["session_photo", "session_clip"];

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

    const body = await req.json();
    const {
      media_url,
      caption,
      post_type,
      game_id,
      tournament_id,
      latitude,
      longitude,
      location_name,
    } = body;

    // --- Validate required fields ---

    if (!media_url || typeof media_url !== "string" || media_url.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "media_url is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (post_type && !VALID_POST_TYPES.includes(post_type)) {
      return new Response(
        JSON.stringify({
          error: `post_type must be one of: ${VALID_POST_TYPES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Verify user has a profile ---

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

    // --- Build the insert row ---

    const row: Record<string, unknown> = {
      user_id: user.id,
      media_url: media_url.trim(),
    };

    if (post_type) row.post_type = post_type;
    if (caption) row.caption = caption;
    if (game_id) row.game_id = game_id;
    if (tournament_id) row.tournament_id = tournament_id;
    if (location_name) row.location_name = location_name;

    if (latitude != null && longitude != null) {
      row.location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    // --- Insert the post ---

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert(row)
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, post }),
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
