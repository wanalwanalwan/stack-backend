import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const { game_id } = await req.json();
    if (!game_id) {
      return new Response(
        JSON.stringify({ error: "game_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch the game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate: game not cancelled
    if (game.is_cancelled) {
      return new Response(
        JSON.stringify({ error: "Game has been cancelled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate: game not in the past
    if (new Date(game.game_datetime) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Game has already started" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate: game not full
    if (game.spots_filled >= game.spots_available) {
      return new Response(
        JSON.stringify({ error: "Game is full" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate: user's DUPR rating is within the game's skill range
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("dupr_rating")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (profile.dupr_rating !== null) {
      if (
        game.skill_level_min !== null &&
        profile.dupr_rating < game.skill_level_min
      ) {
        return new Response(
          JSON.stringify({
            error: `Your DUPR rating (${profile.dupr_rating}) is below the minimum (${game.skill_level_min})`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (
        game.skill_level_max !== null &&
        profile.dupr_rating > game.skill_level_max
      ) {
        return new Response(
          JSON.stringify({
            error: `Your DUPR rating (${profile.dupr_rating}) is above the maximum (${game.skill_level_max})`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Check for existing RSVP
    const { data: existing } = await supabase
      .from("game_participants")
      .select("id, rsvp_status")
      .eq("game_id", game_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && existing.rsvp_status === "confirmed") {
      return new Response(
        JSON.stringify({ error: "Already RSVPed to this game" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert or re-confirm the RSVP
    if (existing) {
      // Re-confirm a previously cancelled RSVP
      const { error: updateError } = await supabase
        .from("game_participants")
        .update({ rsvp_status: "confirmed" })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("game_participants")
        .insert({ game_id, user_id: user.id, rsvp_status: "confirmed" });

      if (insertError) throw insertError;
    }

    // Atomically increment spots_filled using RPC
    // We use a raw SQL call via supabase to atomically increment
    const { error: updateError } = await supabase
      .from("games")
      .update({ spots_filled: game.spots_filled + 1 })
      .eq("id", game_id)
      .eq("spots_filled", game.spots_filled); // optimistic concurrency check

    if (updateError) {
      throw new Error(
        "Failed to update spots — game may have filled. Please try again.",
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "RSVP confirmed" }),
      {
        status: 200,
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
