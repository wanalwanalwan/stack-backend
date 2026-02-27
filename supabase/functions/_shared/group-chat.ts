export function pickChatCreatorId(chat: Record<string, unknown> | null | undefined): string | null {
  if (!chat) return null;
  const candidates = ["created_by", "creator_id", "owner_id", "user_id"];
  for (const key of candidates) {
    const v = (chat as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export function serializeError(err: unknown) {
  const e = err as Record<string, unknown> | null;
  if (!e) return { message: String(err) };
  return {
    message: typeof e.message === "string" ? e.message : String(err),
    code: typeof e.code === "string" ? e.code : undefined,
    details: typeof e.details === "string" ? e.details : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  };
}

export function isMissingColumnErrorMessage(msg: string, column: string) {
  const m = msg.toLowerCase();
  const c = column.toLowerCase();
  return m.includes("does not exist") && m.includes(c);
}

