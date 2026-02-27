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
    const chat_id = body?.chat_id;
    const user_id = body?.user_id;

    if (!isUuid(chat_id) || !isUuid(user_id)) {
      return new Response(JSON.stringify({ error: "chat_id and user_id are required UUIDs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot add yourself (already a member)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: creator or admin member of the chat.
    const { data: chat, error: chatError } = await admin
      .from("group_chats")
      .select("*")
      .eq("id", chat_id)
      .maybeSingle();
    if (chatError) throw chatError;
    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creatorId = pickChatCreatorId(chat as unknown as Record<string, unknown>);
    let isAdminOrCreator = creatorId === user.id;
    if (!isAdminOrCreator) {
      const memberLookups = [
        admin
          .from("group_chat_members")
          .select("role")
          .eq("chat_id", chat_id)
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("group_chat_members")
          .select("role")
          .eq("group_chat_id", chat_id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ];

      let me: { role?: string } | null = null;
      for (const p of memberLookups) {
        const { data, error } = await p;
        if (error) {
          const msg = (error as { message?: string } | null)?.message;
          if (typeof msg === "string" && (isMissingColumnErrorMessage(msg, "chat_id") || isMissingColumnErrorMessage(msg, "group_chat_id"))) {
            continue;
          }
          throw error;
        }
        me = data as unknown as { role?: string } | null;
        break;
      }
      isAdminOrCreator = me?.role === "admin";
    }

    if (!isAdminOrCreator) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let existing: unknown = null;
    {
      const existingLookups = [
        admin
          .from("group_chat_members")
          .select("user_id")
          .eq("chat_id", chat_id)
          .eq("user_id", user_id)
          .maybeSingle(),
        admin
          .from("group_chat_members")
          .select("user_id")
          .eq("group_chat_id", chat_id)
          .eq("user_id", user_id)
          .maybeSingle(),
      ];
      for (const p of existingLookups) {
        const { data, error } = await p;
        if (error) {
          const msg = (error as { message?: string } | null)?.message;
          if (typeof msg === "string" && (isMissingColumnErrorMessage(msg, "chat_id") || isMissingColumnErrorMessage(msg, "group_chat_id"))) {
            continue;
          }
          throw error;
        }
        existing = data;
        break;
      }
    }
    if (existing) {
      return new Response(JSON.stringify({ error: "User is already a member" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertCandidates = [
      { chat_id, user_id, role: "member" },
      { group_chat_id: chat_id, user_id, role: "member" },
    ];
    let inserted = false;
    let lastInsertError: unknown = null;
    for (const row of insertCandidates) {
      const { error } = await admin.from("group_chat_members").insert(row);
      if (!error) {
        inserted = true;
        lastInsertError = null;
        break;
      }
      lastInsertError = error;
      const msg = (error as { message?: string } | null)?.message;
      if (typeof msg === "string" && (isMissingColumnErrorMessage(msg, "chat_id") || isMissingColumnErrorMessage(msg, "group_chat_id"))) {
        continue;
      }
    }
    if (!inserted) throw lastInsertError ?? new Error("Failed to add member");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", detail: serializeError(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

