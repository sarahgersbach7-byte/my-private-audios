import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  adminCreateUploadUrl,
  adminDeleteAudio,
  adminInsertAudio,
  adminListAudios,
  adminListUsage,
  adminLock,
  adminStatus,
  adminUnlock,
  adminUpdateAudio,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { CustomerManager } from "@/components/admin/CustomerManager";
import { AppointmentManager } from "@/components/admin/AppointmentManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/verwaltung")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Verwaltung – Seelenreisen Hörbereich" },
      { name: "description", content: "Audios verwalten und Zugänge freischalten." },
      { property: "og:title", content: "Verwaltung – Seelenreisen Hörbereich" },
      { property: "og:description", content: "Audios verwalten und Zugänge freischalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Verwaltung,
});

type AudioRow = {
  id: string;
  title: string;
  description: string | null;
  group_name: string | null;
  sort_order: number;
  storage_path: string;
  duration_seconds: number | null;
  published: boolean;
};

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const value = Number.isFinite(el.duration) ? Math.round(el.duration) : null;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
}

function CodeGate() {
  const queryClient = useQueryClient();
  const unlock = useServerFn(adminUnlock);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await unlock({ data: { code } });
      if (result.ok) {
        await queryClient.invalidateQueries();
        toast.success("Verwaltung geöffnet.");
      } else {
        toast.error("Der Code stimmt nicht.");
        setCode("");
      }
    } catch {
      toast.error("Das hat nicht funktioniert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl text-primary">Code eingeben</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-code">Zugangscode</Label>
          <Input
            id="admin-code"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || code.length === 0}>
          Öffnen
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline">
          Zur Startseite
        </Link>
      </p>
    </main>
  );
}

function Verwaltung() {
  const queryClient = useQueryClient();
  const status = useServerFn(adminStatus);
  const lock = useServerFn(adminLock);

  const statusQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status(),
  });

  if (statusQuery.isLoading) {
    return <p className="mx-auto max-w-5xl px-6 py-16 text-muted-foreground">Einen Moment…</p>;
  }
  if (!statusQuery.data?.unlocked) {
    return <CodeGate />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <span className="text-sm uppercase tracking-[0.28em] text-primary">Seelenreisen</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await lock();
              queryClient.clear();
            }}
          >
            Verwaltung schliessen
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl text-primary">Verwaltung</h1>
        <Tabs defaultValue="audios" className="mt-8">
          <TabsList>
            <TabsTrigger value="audios">Audios</TabsTrigger>
            <TabsTrigger value="nutzer">Nutzer & Codes</TabsTrigger>
            <TabsTrigger value="termine">Terminanfragen</TabsTrigger>
            <TabsTrigger value="nutzung">Nutzung</TabsTrigger>
          </TabsList>
          <TabsContent value="audios" className="mt-6">
            <AudioManager />
          </TabsContent>
          <TabsContent value="nutzer" className="mt-6">
            <CustomerManager />
          </TabsContent>
          <TabsContent value="termine" className="mt-6">
            <AppointmentManager />
          </TabsContent>
          <TabsContent value="nutzung" className="mt-6">
            <UsageOverview />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AudioManager() {
  const queryClient = useQueryClient();
  const listAudios = useServerFn(adminListAudios);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const insertAudio = useServerFn(adminInsertAudio);
  const updateAudioFn = useServerFn(adminUpdateAudio);
  const deleteAudioFn = useServerFn(adminDeleteAudio);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);

  const audiosQuery = useQuery({
    queryKey: ["audios", "admin"],
    queryFn: async () => (await listAudios()) as AudioRow[],
  });

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const duration = await readDuration(file);
      const { path, token } = await createUploadUrl({ data: { fileName: file.name } });
      const { error: uploadError } = await supabase.storage
        .from("audios")
        .uploadToSignedUrl(path, token, file, { contentType: file.type || "audio/mpeg" });
      if (uploadError) throw uploadError;

      await insertAudio({
        data: {
          title: title || file.name,
          description: description || null,
          groupName: group || null,
          storagePath: path,
          durationSeconds: duration,
        },
      });

      toast.success("Audio hochgeladen.");
      setFile(null);
      setTitle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["audios"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload nicht möglich.");
    } finally {
      setBusy(false);
    }
  }

  const updateAudio = useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) =>
      updateAudioFn({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audios"] }),
    onError: () => toast.error("Änderung nicht gespeichert."),
  });

  const deleteAudio = useMutation({
    mutationFn: (audio: AudioRow) =>
      deleteAudioFn({ data: { id: audio.id, storagePath: audio.storage_path } }),
    onSuccess: () => {
      toast.success("Audio gelöscht.");
      queryClient.invalidateQueries({ queryKey: ["audios"] });
    },
    onError: () => toast.error("Löschen nicht möglich."),
  });

  return (
    <div className="space-y-10">
      <form onSubmit={handleUpload} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl">Neues Audio hochladen</h2>
        <div className="space-y-2">
          <Label htmlFor="file">Audiodatei (MP3, M4A, WAV)</Label>
          <Input
            id="file"
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group">Gruppe (z.B. Projektname)</Label>
            <Input
              id="group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Seelenreisen"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Beschreibung</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <Button type="submit" disabled={busy || !file}>
          {busy ? "Wird hochgeladen…" : "Hochladen"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl">Vorhandene Audios</h2>
        {(audiosQuery.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Audios vorhanden.</p>
        )}
        {(audiosQuery.data ?? []).map((audio) => (
          <div key={audio.id} className="rounded-lg border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`t-${audio.id}`}>Titel</Label>
                <Input
                  id={`t-${audio.id}`}
                  defaultValue={audio.title}
                  onBlur={(e) =>
                    e.target.value !== audio.title &&
                    updateAudio.mutate({ id: audio.id, patch: { title: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`g-${audio.id}`}>Gruppe</Label>
                <Input
                  id={`g-${audio.id}`}
                  defaultValue={audio.group_name ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (audio.group_name ?? "") &&
                    updateAudio.mutate({
                      id: audio.id,
                      patch: { group_name: e.target.value || null },
                    })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={`d-${audio.id}`}>Beschreibung</Label>
                <Textarea
                  id={`d-${audio.id}`}
                  rows={2}
                  defaultValue={audio.description ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (audio.description ?? "") &&
                    updateAudio.mutate({
                      id: audio.id,
                      patch: { description: e.target.value || null },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`s-${audio.id}`}>Reihenfolge</Label>
                <Input
                  id={`s-${audio.id}`}
                  type="number"
                  defaultValue={audio.sort_order}
                  onBlur={(e) =>
                    Number(e.target.value) !== audio.sort_order &&
                    updateAudio.mutate({
                      id: audio.id,
                      patch: { sort_order: Number(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id={`p-${audio.id}`}
                    checked={audio.published}
                    onCheckedChange={(checked) =>
                      updateAudio.mutate({ id: audio.id, patch: { published: checked } })
                    }
                  />
                  <Label htmlFor={`p-${audio.id}`}>Sichtbar</Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`„${audio.title}" wirklich löschen?`)) {
                      deleteAudio.mutate(audio);
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Löschen
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function UsageOverview() {
  const listUsage = useServerFn(adminListUsage);
  const usageQuery = useQuery({
    queryKey: ["usage"],
    queryFn: () => listUsage(),
  });

  const events = usageQuery.data?.events ?? [];
  const profiles = usageQuery.data?.profiles ?? [];

  const perUser = new Map<string, { plays: number; devices: Set<string>; last: string }>();
  for (const event of events) {
    const entry = perUser.get(event.user_id) ?? {
      plays: 0,
      devices: new Set<string>(),
      last: event.created_at,
    };
    entry.plays += 1;
    if (event.device_fingerprint) entry.devices.add(event.device_fingerprint);
    perUser.set(event.user_id, entry);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl">Nutzung</h2>
      <p className="text-sm text-muted-foreground">
        Auffällig ist ein Zugang, der von vielen verschiedenen Geräten genutzt wird.
      </p>
      {perUser.size === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Wiedergaben.</p>
      )}
      <ul className="space-y-2">
        {[...perUser.entries()].map(([userId, entry]) => {
          const profile = profiles.find((p) => p.id === userId);
          const suspicious = entry.devices.size >= 4;
          return (
            <li
              key={userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="text-sm font-medium">{profile?.email ?? "Unbekannt"}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.plays} Wiedergaben · {entry.devices.size} Gerät
                  {entry.devices.size === 1 ? "" : "e"} · zuletzt{" "}
                  {new Date(entry.last).toLocaleDateString("de-CH")}
                </p>
              </div>
              {suspicious && (
                <span className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
                  auffällig
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
