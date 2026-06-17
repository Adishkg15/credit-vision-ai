import { Rocket, Wallet, ShieldCheck } from "lucide-react";
import type { AssessmentResult } from "@/lib/scoring";

export function AdvancedScores({ r }: { r: AssessmentResult }) {
  const a = r.advanced;
  if (!a) return null;
  return (
    <div className="card-elevated p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Next-Gen Credit Indicators</h2>
        <p className="text-xs text-muted-foreground">
          Three forward-looking indices that complement the overall risk score.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ScoreCard
          tone="brand"
          icon={<Rocket className="h-4 w-4" />}
          title="Future Potential Score"
          subtitle="Predicted earning capacity — not a credit score."
          score={a.futurePotential}
          breakdown={a.futurePotentialBreakdown}
        />
        <ScoreCard
          tone="accent"
          icon={<Wallet className="h-4 w-4" />}
          title="Financial Discipline Index"
          subtitle="Savings, bills, UPI, emergency fund and spending."
          score={a.financialDiscipline}
          breakdown={a.financialDisciplineBreakdown}
        />
        <ScoreCard
          tone="success"
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Trust Score"
          subtitle="Information completeness and data consistency. Missing credit history does not lower this."
          score={a.trust}
          breakdown={a.trustBreakdown}
        />
      </div>
    </div>
  );
}

function ScoreCard({ tone, icon, title, subtitle, score, breakdown }: {
  tone: "brand" | "accent" | "success";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  score: number;
  breakdown: { label: string; contribution: number }[];
}) {
  const colorMap: Record<string, { text: string; bar: string; border: string }> = {
    brand:   { text: "text-primary",  bar: "bg-[image:var(--gradient-brand)]", border: "border-primary/30" },
    accent:  { text: "text-accent",   bar: "bg-accent",                          border: "border-accent/30" },
    success: { text: "text-success",  bar: "bg-success",                         border: "border-success/30" },
  };
  const c = colorMap[tone];
  const max = Math.max(...breakdown.map(b => b.contribution), 1);

  return (
    <div className={`rounded-xl border ${c.border} bg-surface-2/40 p-4`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${c.text}`}>
        {icon}{title}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div className="font-display text-4xl font-bold text-gradient tabular-nums">{Math.round(score)}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>

      <ul className="mt-4 space-y-1.5">
        {breakdown.map(b => (
          <li key={b.label} className="text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="font-mono">+{b.contribution}</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${(b.contribution / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
