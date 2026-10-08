import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tells the signed-in account whether it is the administrator and whether it
 * has listening access. The checks run server-side against the database; the
 * internal helper functions are not exposed to the browser API.
 */
export const getMyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw roleError;

    const isAdmin = (roles ?? []).some((row) => row.role === "admin");
    if (isAdmin) return { isAdmin: true, hasAccess: true };

    const { data: code, error: codeError } = await supabaseAdmin
      .from("book_codes")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (codeError) throw codeError;

    return { isAdmin: false, hasAccess: Boolean(code) };
  });
