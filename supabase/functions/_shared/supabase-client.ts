import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase client that respects RLS using the user's JWT.
 * Use this for operations that should be scoped to the authenticated user.
 */
export function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: authHeader },
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
