import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient, createAdminClient } from "../_shared/supabase-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userClient = createUserClient(req);
    const adminClient = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { round_id, team1_score, team2_score } = await req.json();

    if (!round_id || team1_score == null || team2_score == null) {
      return new Response(
        JSON.stringify({ error: "round_id, team1_score, and team2_score are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (team1_score < 0 || team2_score < 0) {
      return new Response(
        JSON.stringify({ error: "Scores must be non-negative" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the round to get the game_id
    const { data: round, error: roundError } = await adminClient
      .from("round_robin_rounds")
      .select("id, game_id")
      .eq("id", round_id)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: "Round not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user is a participant or creator
    const { data: participant } = await adminClient
      .from("game_participants")
      .select("id")
      .eq("game_id", round.game_id)
      .eq("user_id", user.id)
      .eq("rsvp_status", "confirmed")
      .maybeSingle();

    const { data: game } = await adminClient
      .from("games")
      .select("creator_id")
      .eq("id", round.game_id)
      .single();

    if (!participant && game?.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only game participants can submit scores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update the score
    const { error: updateError } = await adminClient
      .from("round_robin_rounds")
      .update({
        team1_score,
        team2_score,
        score_entered_by: user.id,
      })
      .eq("id", round_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Score submitted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
