import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Link2, Pencil, Trash2, Unlink, X } from "lucide-react";
import { toast } from "sonner";

import {
  adminAddCodes,
  adminDeleteCode,
  adminLinkCode,
  adminListCodes,
  adminUnlinkCode,
  adminUpdateProfile,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type CodeRow = {
  id: string;
  code: string;
  user_id: string | null;
  linked_at: string | null;
  created_at: string;
};
type ProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  newsletter: boolean;
  newsletter_at: string | null;
  created_at: string;
};

const QUERY_KEY = ["book-codes"];

function formatDate(value: string | null) {
  if (!value) return "–";
  return new Date(value).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Das hat nicht funktioniert.";
}

export function CustomerManager() {
  const listCodes = useServerFn(adminListCodes);
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => listCodes() });

  const codes = (query.data?.codes ?? []) as CodeRow[];
  const profiles = (query.data?.profiles ?? []) as ProfileRow[];

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Einen Moment…</p>;
  if (query.isError)
    return <p className="text-sm text-destructive">Die Daten konnten nicht geladen werden.</p>;

  return (
    <div className="space-y-12">
      <UsersTable codes={codes} profiles={profiles} />
      <CodesSection codes={codes} profiles={profiles} />
    </div>
  );
}

/* ---------------- Nutzer ---------------- */

function UsersTable({ codes, profiles }: { codes: CodeRow[]; profiles: ProfileRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return profiles
      .map((p) => ({ profile: p, code: codes.find((c) => c.user_id === p.id) ?? null }))
      .filter(({ profile, code }) => {
        if (!term) return true;
        return [profile.email, profile.first_name, profile.last_name, code?.code]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term));
      });
  }, [codes, profiles, search]);

  const newsletterCount = profiles.filter((p) => p.newsletter).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">Nutzer</h2>
          <p className="text-sm text-muted-foreground">
            {profiles.length} Konten · {newsletterCount} für Neuigkeiten angemeldet
          </p>
        </div>
        <Input
          placeholder="Suchen (Name, E-Mail, Code)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-secondary text-xs uppercase tracking-wider text-secondary-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Vorname</th>
              <th className="px-4 py-3 font-medium">Nachname</th>
              <th className="px-4 py-3 font-medium">E-Mail</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Neuigkeiten</th>
              <th className="px-4 py-3 font-medium">Registriert</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Keine Nutzer gefunden.
                </td>
              </tr>
            )}
            {rows.map(({ profile, code }) =>
              editing === profile.id ? (
                <EditUserRow
                  key={profile.id}
                  profile={profile}
                  code={code}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <tr key={profile.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{profile.first_name ?? "–"}</td>
                  <td className="px-4 py-3">{profile.last_name ?? "–"}</td>
                  <td className="px-4 py-3">{profile.email}</td>
                  <td className="px-4 py-3">
                    {code ? (
                      <span className="font-mono tracking-wider">{code.code}</span>
                    ) : (
                      <span className="text-muted-foreground">kein Code</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {profile.newsletter ? (
                      <span>
                        <span className="font-medium text-primary">Ja</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(profile.newsletter_at)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nein</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(profile.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(profile.id)}
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditUserRow({
  profile,
  code,
  onDone,
}: {
  profile: ProfileRow;
  code: CodeRow | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(adminUpdateProfile);
  const unlinkFn = useServerFn(adminUnlinkCode);
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [newsletter, setNewsletter] = useState(profile.newsletter);

  const save = useMutation({
    mutationFn: () =>
      updateFn({ data: { id: profile.id, firstName, lastName, newsletter } }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const unlink = useMutation({
    mutationFn: (codeId: string) => unlinkFn({ data: { codeId } }),
    onSuccess: () => {
      toast.success("Code getrennt. Das Konto hat keinen Zugang mehr.");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <tr className="border-b border-border bg-muted/40 last:border-0">
      <td className="px-4 py-3">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-label="Vorname" />
      </td>
      <td className="px-4 py-3">
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} aria-label="Nachname" />
      </td>
      <td className="px-4 py-3">{profile.email}</td>
      <td className="px-4 py-3">
        {code ? (
          <div className="flex items-center gap-2">
            <span className="font-mono tracking-wider">{code.code}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={unlink.isPending}
              onClick={() => {
                if (window.confirm(`Code ${code.code} von ${profile.email} trennen?`))
                  unlink.mutate(code.id);
              }}
            >
              <Unlink className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Trennen
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Verknüpfen unten bei „Codes“</span>
        )}
      </td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={newsletter} onCheckedChange={(v) => setNewsletter(v === true)} />
          angemeldet
        </label>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(profile.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            Speichern
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone} aria-label="Abbrechen">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* ---------------- Codes ---------------- */

type Filter = "all" | "free" | "linked";

function CodesSection({ codes, profiles }: { codes: CodeRow[]; profiles: ProfileRow[] }) {
  const queryClient = useQueryClient();
  const unlinkFn = useServerFn(adminUnlinkCode);
  const deleteFn = useServerFn(adminDeleteCode);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<string | null>(null);

  const freeCount = codes.filter((c) => !c.user_id).length;

  const visible = codes.filter((c) => {
    if (filter === "free" && c.user_id) return false;
    if (filter === "linked" && !c.user_id) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const email = profiles.find((p) => p.id === c.user_id)?.email ?? "";
    return c.code.includes(term) || email.includes(term);
  });

  const unlink = useMutation({
    mutationFn: (codeId: string) => unlinkFn({ data: { codeId } }),
    onSuccess: () => {
      toast.success("Code getrennt.");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (codeId: string) => deleteFn({ data: { codeId } }),
    onSuccess: () => {
      toast.success("Code gelöscht.");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">Codes</h2>
          <p className="text-sm text-muted-foreground">
            {codes.length} Codes · {codes.length - freeCount} vergeben · {freeCount} frei
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Alle"],
              ["free", "Frei"],
              ["linked", "Vergeben"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
          <Input
            placeholder="Code oder E-Mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {visible.length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">Keine Codes gefunden.</li>
        )}
        {visible.map((code) => {
          const owner = profiles.find((p) => p.id === code.user_id);
          return (
            <li key={code.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-base tracking-[0.2em]">{code.code}</span>
                  {code.user_id ? (
                    <span className="text-sm">
                      {owner?.email ?? "Konto"}
                      <span className="ml-2 text-xs text-muted-foreground">
                        seit {formatDate(code.linked_at)}
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      frei
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {code.user_id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={unlink.isPending}
                      onClick={() => {
                        if (window.confirm(`Code ${code.code} von ${owner?.email ?? "Konto"} trennen?`))
                          unlink.mutate(code.id);
                      }}
                    >
                      <Unlink className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Trennen
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLinking(linking === code.id ? null : code.id)}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Verknüpfen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Code löschen"
                        onClick={() => {
                          if (window.confirm(`Code ${code.code} löschen?`)) remove.mutate(code.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {linking === code.id && !code.user_id && (
                <LinkForm codeId={code.id} onDone={() => setLinking(null)} />
              )}
            </li>
          );
        })}
      </ul>

      <AddCodesForm />
    </section>
  );
}

function LinkForm({ codeId, onDone }: { codeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const linkFn = useServerFn(adminLinkCode);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const link = useMutation({
    mutationFn: () => linkFn({ data: { codeId, email, firstName, lastName } }),
    onSuccess: () => {
      toast.success("Verknüpft. Die Person meldet sich mit E-Mail und Code an.");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        link.mutate();
      }}
      className="mt-4 grid gap-3 rounded-md border border-border bg-muted/40 p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
    >
      <div className="space-y-1">
        <Label htmlFor={`link-email-${codeId}`}>E-Mail</Label>
        <Input
          id={`link-email-${codeId}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`link-first-${codeId}`}>Vorname</Label>
        <Input id={`link-first-${codeId}`} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`link-last-${codeId}`}>Nachname</Label>
        <Input id={`link-last-${codeId}`} value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <Button type="submit" disabled={link.isPending}>
        Verknüpfen
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-4">
        Gibt es schon ein Konto mit dieser E-Mail, wird es verknüpft und der Code wird sein
        Passwort. Sonst wird ein neues Konto angelegt (Namen sind dann optional).
      </p>
    </form>
  );
}

function AddCodesForm() {
  const queryClient = useQueryClient();
  const addFn = useServerFn(adminAddCodes);
  const [text, setText] = useState("");

  const add = useMutation({
    mutationFn: () => addFn({ data: { codes: text.split(/[\s,;]+/) } }),
    onSuccess: (res) => {
      toast.success(`${res.added} neue Codes hinzugefügt.`);
      setText("");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
      className="space-y-3 rounded-lg border border-border bg-card p-5"
    >
      <h3 className="text-lg">Codes hinzufügen</h3>
      <p className="text-sm text-muted-foreground">
        6-stellige Codes, durch Zeilenumbruch, Komma oder Leerzeichen getrennt. Bereits vorhandene
        werden übersprungen.
      </p>
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" disabled={add.isPending || text.trim().length === 0}>
        Hinzufügen
      </Button>
    </form>
  );
}
