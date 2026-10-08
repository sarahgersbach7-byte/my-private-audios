import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  adminListAppointments,
  adminTelegramAdoptLatest,
  adminTelegramStatus,
  adminTelegramTest,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export function AppointmentManager() {
  const qc = useQueryClient();
  const list = useServerFn(adminListAppointments);
  const status = useServerFn(adminTelegramStatus);
  const adopt = useServerFn(adminTelegramAdoptLatest);
  const test = useServerFn(adminTelegramTest);

  const listQuery = useQuery({ queryKey: ["appointments"], queryFn: () => list() });
  const statusQuery = useQuery({ queryKey: ["telegram-status"], queryFn: () => status() });

  const adoptMut = useMutation({
    mutationFn: () => adopt(),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Empfänger ist jetzt: ${r.label}`);
      else toast.error("Niemand gefunden. Bitte zuerst im Bot auf Start drücken oder ihm eine Nachricht schreiben.");
      qc.invalidateQueries({ queryKey: ["telegram-status"] });
    },
    onError: () => toast.error("Telegram ist nicht erreichbar."),
  });
  const testMut = useMutation({
    mutationFn: () => test(),
    onSuccess: (r) => (r.ok ? toast.success("Testnachricht gesendet.") : toast.error("Noch kein Empfänger festgelegt.")),
    onError: () => toast.error("Testnachricht fehlgeschlagen."),
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl text-primary">Telegram-Empfänger</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aktuell: <strong className="text-foreground">{statusQuery.data?.label ?? "noch niemand"}</strong>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Empfänger wechseln: Die neue Person öffnet{" "}
          <a href="https://t.me/sarahterminbot" target="_blank" rel="noreferrer" className="text-primary underline">
            t.me/sarahterminbot
          </a>{" "}
          und drückt <em>Start</em> (oder schreibt eine Nachricht). Danach hier klicken.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => adoptMut.mutate()} disabled={adoptMut.isPending}>
            Letzte Person übernehmen
          </Button>
          <Button variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
            Testnachricht senden
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-xl text-primary">Terminanfragen</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Noch keine Anfragen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3">Eingegangen</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">E-Mail</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Wunschdatum</th>
                  <th className="p-3">Uhrzeit</th>
                  <th className="p-3">Kommentar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("de-CH")}</td>
                    <td className="p-3">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "–"}</td>
                    <td className="p-3">{r.email ?? "–"}</td>
                    <td className="p-3">{r.code ?? "–"}</td>
                    <td className="p-3 whitespace-nowrap">{new Date(r.requested_date + "T00:00:00").toLocaleDateString("de-CH")}</td>
                    <td className="p-3">{r.requested_time}</td>
                    <td className="p-3 max-w-xs whitespace-pre-wrap">{r.comment ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
