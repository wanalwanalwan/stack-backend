import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase client that respects RLS using the user's JWT.
 * Use this for operations that should be scoped to the authenticated user.
 */
export function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  // If Authorization is missing, create a client without a user context.
  // Callers should then rely on `supabase.auth.getUser()` returning null and respond with 401.
  if (!authHeader) {
    return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  }

  // Some clients mistakenly send the raw JWT without the "Bearer " prefix.
  // Supabase Auth expects the standard "Authorization: Bearer <token>" format.
  const normalizedAuthHeader = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader
    : `Bearer ${authHeader}`;
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: normalizedAuthHeader },
      },
    },
  );
}

/**
 * Creates a Supabase admin client that bypasses RLS.
 * Use this for operations that need full database access (e.g., cleanup jobs).
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
