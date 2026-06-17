import { useEffect, useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Info, ListChecks } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateAIInsights, type AIInsightsResult } from "@/lib/ai-insights.functions";
import type { AssessmentInputs, AssessmentResult } from "@/lib/scoring";

export function AIInsights({ inputs, result }: { inputs: AssessmentInputs; result: AssessmentResult }) {
  const run = useServerFn(generateAIInsights);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AIInsightsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    run({ data: { inputs, result } })
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : "AI unavailable"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inputs, result, run]);

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> AI Credit Intelligence
          </h2>
          <p className="text-xs text-muted-foreground">
            AI generates the narrative — the rule engine owns the score.
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {err}
        </p>
      )}

      {data && (
        <>
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-primary">Applicant Summary</div>
            <p className="mt-2 text-sm leading-relaxed">{data.summary}</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Block tone="success" icon={<CheckCircle2 className="h-4 w-4" />} title="Key Strengths" items={data.strengths} />
            <Block tone="warning" icon={<AlertTriangle className="h-4 w-4" />} title="Concerns" items={data.concerns} />
            <Block tone="info" icon={<Info className="h-4 w-4" />} title="Missing Information" items={data.missingInformation} footnote="Lowers confidence, not risk." />
            <Block tone="brand" icon={<ListChecks className="h-4 w-4" />} title="Personalized Improvement Plan" items={data.improvementPlan} />
          </div>
        </>
      )}

      {loading && !data && (
        <p className="mt-6 text-sm text-muted-foreground">Analyzing assessment…</p>
      )}
    </div>
  );
}

function Block({ tone, icon, title, items, footnote }: {
  tone: "success" | "warning" | "info" | "brand";
  icon: React.ReactNode;
  title: string;
  items: string[];
  footnote?: string;
}) {
  const map = {
    success: { text: "text-success", border: "border-success/30", bg: "bg-success/10" },
    warning: { text: "text-warning", border: "border-warning/30", bg: "bg-warning/10" },
    info:    { text: "text-info",    border: "border-info/30",    bg: "bg-info/10" },
    brand:   { text: "text-primary", border: "border-primary/30", bg: "bg-primary/10" },
  }[tone];
  return (
    <div className={`rounded-xl border ${map.border} ${map.bg} p-4`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${map.text}`}>{icon}{title}</div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs italic text-muted-foreground">No items.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="rounded-lg bg-background/40 px-3 py-2 text-foreground/90">{it}</li>
          ))}
        </ul>
      )}
      {footnote && <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{footnote}</p>}
    </div>
  );
}
