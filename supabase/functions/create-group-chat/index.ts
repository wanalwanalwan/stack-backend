import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}

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
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          detail: authError?.message ?? "No user found",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : null;

    const memberIdsFromArray = Array.isArray(body?.member_ids) ? body.member_ids : null;
    const memberIdSingle = body?.member_id;

    const memberIds: string[] = [];
    if (memberIdsFromArray) {
      for (const id of memberIdsFromArray) {
        if (isUuid(id)) memberIds.push(id);
      }
    } else if (isUuid(memberIdSingle)) {
      memberIds.push(memberIdSingle);
    }

    // Remove creator if caller included it, de-dupe remaining IDs.
    const otherMemberIds = Array.from(new Set(memberIds)).filter((id) => id !== user.id);

    // Allow creating a chat even if only 1 other member is provided (creator + 1 friend).
    // If no other members are provided, we still create the chat with just the creator.

    const { data: chat, error: chatError } = await supabase
      .from("group_chats")
      .insert({
        created_by: user.id,
        name: name && name.length > 0 ? name : null,
      })
      .select("id, created_by, name, created_at")
      .single();

    if (chatError) throw chatError;

    const membersToInsert = [
      { chat_id: chat.id, user_id: user.id, role: "admin" },
      ...otherMemberIds.map((id) => ({ chat_id: chat.id, user_id: id, role: "member" })),
    ];

    const { error: memberError } = await supabase.from("group_chat_members").insert(membersToInsert);
    if (memberError) throw memberError;

    return new Response(JSON.stringify({ success: true, chat }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

