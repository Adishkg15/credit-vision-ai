import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import type { AssessmentResult } from "@/lib/scoring";

export function ExplainableAI({ r }: { r: AssessmentResult }) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Explainable AI</h2>
          <p className="text-xs text-muted-foreground">
            Why this score was assigned. Missing credit history is never treated as risk.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Column
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Positive Contributors"
          glyph="+"
          items={r.strengths}
          empty="No standout positive signals from current inputs."
        />
        <Column
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Risk Contributors"
          glyph="−"
          items={r.concerns}
          empty="No active risk signals flagged."
        />
        <Column
          tone="info"
          icon={<HelpCircle className="h-4 w-4" />}
          title="Missing Information"
          glyph="?"
          items={r.missingInformation}
          empty="Profile is fully populated."
          footnote="Not counted as risk — only reduces confidence."
        />
      </div>
    </div>
  );
}

function Column({
  tone, icon, title, glyph, items, empty, footnote,
}: {
  tone: "success" | "warning" | "info";
  icon: React.ReactNode; title: string; glyph: string;
  items: string[]; empty: string; footnote?: string;
}) {
  const map = {
    success: { text: "text-success", border: "border-success/30", bg: "bg-success/10" },
    warning: { text: "text-warning", border: "border-warning/30", bg: "bg-warning/10" },
    info:    { text: "text-info",    border: "border-info/30",    bg: "bg-info/10" },
  }[tone];
  return (
    <div className={`rounded-xl border ${map.border} ${map.bg} p-4`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${map.text}`}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs italic text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-background/40 px-3 py-2">
              <span className={`font-mono font-bold ${map.text}`}>{glyph}</span>
              <span className="text-foreground/90">{it}</span>
            </li>
          ))}
        </ul>
      )}
      {footnote && <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{footnote}</p>}
    </div>
  );
}
