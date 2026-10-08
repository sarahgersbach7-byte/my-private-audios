import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarIcon, Check } from "lucide-react";
import { toast } from "sonner";

import { requestAppointment } from "@/lib/appointment.functions";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/termin")({
  head: () => ({
    meta: [
      { title: "1:1 Seelenreise – Termin anfragen" },
      { name: "description", content: "Fragen Sie Ihren Termin für eine persönliche 1:1 Seelenreise an." },
      { property: "og:title", content: "1:1 Seelenreise – Termin anfragen" },
      { property: "og:description", content: "Fragen Sie Ihren Termin für eine persönliche 1:1 Seelenreise an." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TerminPage,
});

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TerminPage() {
  const send = useServerFn(requestAppointment);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) { toast.error("Bitte wählen Sie ein Datum."); return; }
    if (!time) { toast.error("Bitte wählen Sie eine Uhrzeit."); return; }
    setBusy(true);
    try {
      const res = await send({ data: { date: toIso(date), time, comment } });
      if (!res.ok) {
        toast.error("Für Ihr Konto ist kein Zugang aktiv.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-xl px-6 py-14">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl text-primary">Vielen Dank!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ihre Anfrage für eine 1:1 Seelenreise ist angekommen. Sarah meldet sich bei Ihnen, um den Termin zu bestätigen.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => { setSent(false); setDate(undefined); setTime(""); setComment(""); }}>
              Weitere Anfrage
            </Button>
            <Button asChild>
              <Link to="/hoerbereich">Zum Hörbereich</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <Link to="/hoerbereich" className="text-sm text-primary underline underline-offset-4">
        ← Zurück zum Hörbereich
      </Link>
      <h1 className="mt-6 text-3xl text-primary">1:1 Seelenreise</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Wählen Sie Ihren Wunschtermin. Sarah bestätigt Ihnen den Termin persönlich.
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6 rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <Label>Datum</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("w-full justify-start font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date
                  ? date.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                  : "Datum auswählen"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { setDate(d); setOpen(false); }}
                disabled={(d) => d < today}
                weekStartsOn={1}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time">Uhrzeit</Label>
          <Input id="time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Kommentar</Label>
          <Textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Möchten Sie Sarah vorab etwas mitteilen?"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Wird gesendet …" : "Termin anfragen"}
        </Button>
      </form>
    </main>
  );
}
