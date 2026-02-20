import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

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

    const { game_id, user_id } = await req.json();
    if (!game_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "game_id and user_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch the game to verify ownership
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("creator_id")
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

    // Only the host can kick players
    if (game.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the host can remove players" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cannot kick yourself
    if (user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot remove yourself" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Find the participant's RSVP
    const { data: rsvp, error: rsvpError } = await supabase
      .from("game_participants")
      .select("id, rsvp_status")
      .eq("game_id", game_id)
      .eq("user_id", user_id)
      .eq("rsvp_status", "confirmed")
      .maybeSingle();

    if (rsvpError) throw rsvpError;

    if (!rsvp) {
      return new Response(
        JSON.stringify({ error: "Player is not in this game" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cancel their RSVP
    const { error: updateError } = await supabase
      .from("game_participants")
      .update({ rsvp_status: "cancelled" })
      .eq("id", rsvp.id);

    if (updateError) throw updateError;

    // Decrement spots_filled
    const { error: decrementError } = await supabase.rpc(
      "decrement_spots_filled",
      { p_game_id: game_id },
    );

    if (decrementError) throw decrementError;

    return new Response(
      JSON.stringify({ success: true, message: "Player removed" }),
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
