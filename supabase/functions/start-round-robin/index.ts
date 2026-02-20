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

    const { game_id, rounds } = await req.json();

    if (!game_id || !rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return new Response(
        JSON.stringify({ error: "game_id and rounds array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the game using admin client to bypass RLS
    const { data: game, error: gameError } = await adminClient
      .from("games")
      .select("id, creator_id, session_type, round_robin_status")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: gameError?.message || "Game not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (game.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the host can start a round robin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (game.session_type !== "round_robin") {
      return new Response(
        JSON.stringify({ error: `Not a round robin session (type: ${game.session_type})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (game.round_robin_status !== "waiting") {
      return new Response(
        JSON.stringify({ error: `Round robin status is '${game.round_robin_status}', expected 'waiting'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert all round robin rounds using admin client
    const rows = rounds.map((r: {
      round_number: number;
      court_number: number;
      team1_player1: string;
      team1_player2?: string;
      team2_player1: string;
      team2_player2?: string;
      bye_players: string[];
    }) => ({
      game_id,
      round_number: r.round_number,
      court_number: r.court_number,
      team1_player1: r.team1_player1,
      team1_player2: r.team1_player2 || null,
      team2_player1: r.team2_player1,
      team2_player2: r.team2_player2 || null,
      bye_players: r.bye_players || [],
    }));

    const { error: insertError } = await adminClient
      .from("round_robin_rounds")
      .insert(rows);

    if (insertError) throw insertError;

    // Update game status to in_progress using admin client
    const { error: updateError } = await adminClient
      .from("games")
      .update({ round_robin_status: "in_progress" })
      .eq("id", game_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Round robin started" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
