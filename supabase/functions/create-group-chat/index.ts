import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-client.ts";
import { isMissingColumnErrorMessage, pickChatCreatorId, serializeError } from "../_shared/group-chat.ts";

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
    const admin = createAdminClient();

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

    const chatName = name && name.length > 0 ? name : null;
    const chatInsertCandidates: Array<Record<string, unknown>> = [
      { created_by: user.id, name: chatName },
      { creator_id: user.id, name: chatName },
    ];

    let chat: Record<string, unknown> | null = null;
    let lastChatError: unknown = null;
    for (const row of chatInsertCandidates) {
      const { data, error } = await admin.from("group_chats").insert(row).select("*").single();
      if (!error && data) {
        chat = data as unknown as Record<string, unknown>;
        lastChatError = null;
        break;
      }
      lastChatError = error ?? lastChatError;
      const msg = (error as { message?: string } | null)?.message;
      if (typeof msg === "string") {
        // If the failure is because a specific creator column doesn't exist, try the next candidate.
        if (
          isMissingColumnErrorMessage(msg, "created_by") ||
          isMissingColumnErrorMessage(msg, "creator_id")
        ) {
          continue;
        }
      }
    }

    if (!chat) {
      throw lastChatError ?? new Error("Failed to create chat");
    }

    const chatId = chat["id"];
    if (typeof chatId !== "string" || chatId.length === 0) {
      throw new Error("Chat created but missing id");
    }

    const membersToInsert = [
      { user_id: user.id, role: "admin" },
      ...otherMemberIds.map((id) => ({ user_id: id, role: "member" })),
    ];

    // Membership schema can vary; try common chat id column names.
    const memberInsertCandidates = [
      membersToInsert.map((m) => ({ ...m, chat_id: chatId })),
      membersToInsert.map((m) => ({ ...m, group_chat_id: chatId })),
    ];
    let memberInserted = false;
    let lastMemberError: unknown = null;
    for (const rows of memberInsertCandidates) {
      const { error } = await admin.from("group_chat_members").insert(rows);
      if (!error) {
        memberInserted = true;
        lastMemberError = null;
        break;
      }
      lastMemberError = error;
      const msg = (error as { message?: string } | null)?.message;
      if (typeof msg === "string") {
        if (isMissingColumnErrorMessage(msg, "chat_id") || isMissingColumnErrorMessage(msg, "group_chat_id")) {
          continue;
        }
      }
    }
    if (!memberInserted) throw lastMemberError ?? new Error("Failed to add chat members");

    return new Response(
      JSON.stringify({
        success: true,
        chat: {
          ...chat,
          created_by: pickChatCreatorId(chat),
        },
      }),
      {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", detail: serializeError(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

