import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createUserClient(req);

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

    const { friend_id } = await req.json();
    if (!friend_id) {
      return new Response(
        JSON.stringify({ error: "friend_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (friend_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot send a friend request to yourself" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify recipient exists
    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("id")
      .eq("id", friend_id)
      .maybeSingle();

    if (recipientError || !recipient) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check for existing friendship in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),and(user_id.eq.${friend_id},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existing) {
      const msg =
        existing.status === "pending"
          ? "Friend request already pending"
          : existing.status === "accepted"
            ? "Already friends"
            : "A previous request was declined";
      return new Response(JSON.stringify({ error: msg }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert pending request
    const { error: insertError } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id, status: "pending" });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, message: "Friend request sent" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
