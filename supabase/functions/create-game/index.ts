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

    const body = await req.json();
    const {
      game_datetime,
      location_name,
      latitude,
      longitude,
      skill_level_min,
      skill_level_max,
      spots_available,
      game_format,
      session_name,
      description,
      session_type,
      num_rounds,
      friends_only,
    } = body;

    // --- Validate required fields ---

    if (!game_datetime) {
      return new Response(
        JSON.stringify({ error: "game_datetime is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!spots_available || spots_available < 1) {
      return new Response(
        JSON.stringify({ error: "spots_available must be at least 1" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!game_format || !VALID_FORMATS.includes(game_format)) {
      return new Response(
        JSON.stringify({
          error: `game_format must be one of: ${VALID_FORMATS.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Validate game_datetime is in the future ---

    if (new Date(game_datetime) <= new Date()) {
      return new Response(
        JSON.stringify({ error: "game_datetime must be in the future" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Validate skill level range ---

    if (skill_level_min != null && (skill_level_min < 1.0 || skill_level_min > 8.0)) {
      return new Response(
        JSON.stringify({ error: "skill_level_min must be between 1.0 and 8.0" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (skill_level_max != null && (skill_level_max < 1.0 || skill_level_max > 8.0)) {
      return new Response(
        JSON.stringify({ error: "skill_level_max must be between 1.0 and 8.0" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (
      skill_level_min != null &&
      skill_level_max != null &&
      skill_level_min > skill_level_max
    ) {
      return new Response(
        JSON.stringify({ error: "skill_level_min cannot be greater than skill_level_max" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Validate session type & round robin fields ---

    const validSessionType = session_type || "casual";
    if (!["casual", "round_robin"].includes(validSessionType)) {
      return new Response(
        JSON.stringify({ error: "session_type must be casual or round_robin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (validSessionType === "round_robin") {
      if (!num_rounds || num_rounds < 1 || num_rounds > 30) {
        return new Response(
          JSON.stringify({ error: "num_rounds must be between 1 and 30 for round robin" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (game_format === "drill") {
        return new Response(
          JSON.stringify({ error: "drill format is not supported for round robin" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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
      creator_id: user.id,
      game_datetime,
      spots_available,
      game_format,
    };

    if (session_name) row.session_name = session_name;
    if (location_name) row.location_name = location_name;
    if (description) row.description = description;
    if (skill_level_min != null) row.skill_level_min = skill_level_min;
    if (skill_level_max != null) row.skill_level_max = skill_level_max;

    // Build PostGIS point if coordinates provided
    if (latitude != null && longitude != null) {
      row.location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    // Session type
    row.session_type = validSessionType;
    if (validSessionType === "round_robin") {
      row.num_rounds = num_rounds;
      row.round_robin_status = "waiting";
    }

    // Friends only
    row.friends_only = friends_only === true;

    // Creator is automatically a participant, so start with 1 spot filled
    row.spots_filled = 1;

    // --- Insert the game ---

    const { data: game, error: insertError } = await supabase
      .from("games")
      .insert(row)
      .select()
      .single();

    if (insertError) throw insertError;

    // --- Auto-join the creator as a confirmed participant ---

    const { error: participantError } = await supabase
      .from("game_participants")
      .insert({
        game_id: game.id,
        user_id: user.id,
        rsvp_status: "confirmed",
      });

    if (participantError) throw participantError;

    return new Response(
      JSON.stringify({ success: true, game }),
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
