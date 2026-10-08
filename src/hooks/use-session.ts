import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { getMyStatus } from "@/lib/access.functions";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

function useStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-status", userId],
    enabled: Boolean(userId),
    queryFn: () => getMyStatus(),
  });
}

export function useIsAdmin(userId: string | undefined) {
  const query = useStatus(userId);
  return { ...query, data: query.data ? query.data.isAdmin : undefined };
}

export function useHasAccess(userId: string | undefined) {
  const query = useStatus(userId);
  return { ...query, data: query.data ? query.data.hasAccess : undefined };
}

/** Stable, anonymous device id used to spot shared logins. */
export function getDeviceFingerprint() {
  if (typeof window === "undefined") return undefined;
  const key = "hoerbereich-device-id";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}
