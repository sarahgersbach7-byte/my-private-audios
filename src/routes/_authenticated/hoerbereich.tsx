import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getPlaybackUrl } from "@/lib/audio.functions";
import { getDeviceFingerprint, useHasAccess, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/hoerbereich")({
  head: () => ({
    meta: [
      { title: "Hörbereich – Sarah Gersbach Seelenreisen" },
      { name: "description", content: "Ihre freigeschalteten Audios zum Anhören." },
      { property: "og:title", content: "Hörbereich – Sarah Gersbach Seelenreisen" },
      { property: "og:description", content: "Ihre freigeschalteten Audios zum Anhören." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Hoerbereich,
});

type AudioRow = {
  id: string;
  title: string;
  description: string | null;
  group_name: string | null;
  duration_seconds: number | null;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")} Min.`;
}

function Hoerbereich() {
  const { user } = useSession();
  const { data: hasAccess, isLoading: accessLoading } = useHasAccess(user?.id);
  const fetchUrl = useServerFn(getPlaybackUrl);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audiosQuery = useQuery({
    queryKey: ["audios", "listener"],
    enabled: Boolean(user?.id) && hasAccess === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audios")
        .select("id, title, description, group_name, duration_seconds")
        .eq("published", true)
        .order("group_name", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AudioRow[];
    },
  });


  async function handlePlay(audio: AudioRow) {
    try {
      const result = await fetchUrl({
        data: { audioId: audio.id, deviceFingerprint: getDeviceFingerprint() },
      });
      setActiveId(audio.id);
      setActiveUrl(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das Audio konnte nicht geladen werden.");
    }
  }

  // Hörfortschritt merken und wiederherstellen
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeId) return;
    const key = `hoerposition-${activeId}`;
    const saved = Number(window.localStorage.getItem(key) ?? "0");

    function onLoaded() {
      if (saved > 2 && saved < el!.duration - 5) el!.currentTime = saved;
      void el!.play();
    }
    function onTime() {
      window.localStorage.setItem(key, String(el!.currentTime));
    }
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
    };
  }, [activeId, activeUrl]);

  if (accessLoading) {
    return <p className="mx-auto max-w-5xl px-6 py-16 text-muted-foreground">Einen Moment…</p>;
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-3xl text-primary">Kein Zugang aktiv</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Sie sind angemeldet als <strong>{user?.email}</strong>, aber mit diesem Konto ist kein
          gültiger Code aus dem Buch verknüpft. Bitte melden Sie sich bei Sarah.
        </p>
      </main>
    );
  }

  const audios = audiosQuery.data ?? [];
  const groups = Array.from(new Set(audios.map((a) => a.group_name ?? "")));

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl text-primary">Ihre Audios</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Zugang von {user?.email}. Bitte behalten Sie die Aufnahmen für sich.
      </p>
      <Link to="/termin" className="mt-2 inline-block text-sm text-primary underline underline-offset-4">
        1:1 Seelenreise anfragen
      </Link>

      {audios.length === 0 && (
        <p className="mt-10 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Es sind noch keine Audios hinterlegt.
        </p>
      )}

      {groups.map((group) => (
        <section key={group} className="mt-10">
          {group && (
            <h2 className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{group}</h2>
          )}
          <ul className="mt-4 space-y-3">
            {audios
              .filter((a) => (a.group_name ?? "") === group)
              .map((audio) => (
                <li key={audio.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg">{audio.title}</h3>
                      {audio.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{audio.description}</p>
                      )}
                      {formatDuration(audio.duration_seconds) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDuration(audio.duration_seconds)}
                        </p>
                      )}
                    </div>
                    {activeId !== audio.id && (
                      <Button size="sm" onClick={() => handlePlay(audio)}>
                        <Play className="mr-1 h-4 w-4" aria-hidden="true" /> Anhören
                      </Button>
                    )}
                  </div>
                  {activeId === audio.id && activeUrl && (
                    <audio
                      ref={audioRef}
                      src={activeUrl}
                      controls
                      controlsList="nodownload noplaybackrate"
                      onContextMenu={(e) => e.preventDefault()}
                      className="mt-4 w-full"
                    />
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
