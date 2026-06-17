import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Sparkles, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { computeAssessment, type AssessmentInputs, type AssessmentResult } from "@/lib/scoring";

export function WhatIfSimulator({ inputs, baseline }: { inputs: AssessmentInputs; baseline: AssessmentResult }) {
  const [income, setIncome] = useState(inputs.monthlyIncome);
  const [savings, setSavings] = useState(inputs.savings);
  const [emergency, setEmergency] = useState(inputs.emergencyFundMonths);
  const [tenure, setTenure] = useState(inputs.jobTenureMonths);

  const projected = useMemo(() => computeAssessment({
    ...inputs,
    monthlyIncome: income,
    savings,
    emergencyFundMonths: emergency,
    jobTenureMonths: tenure,
  }), [inputs, income, savings, emergency, tenure]);

  const delta = projected.overallScore - baseline.overallScore;
  const cdelta = projected.confidenceScore - baseline.confidenceScore;

  function reset() {
    setIncome(inputs.monthlyIncome);
    setSavings(inputs.savings);
    setEmergency(inputs.emergencyFundMonths);
    setTenure(inputs.jobTenureMonths);
  }

  // Preset improvement scenarios — projected forward from baseline
  const scenarios = useMemo(() => {
    const presets: { label: string; patch: Partial<AssessmentInputs> }[] = [
      { label: "Savings → ₹50,000",         patch: { savings: Math.max(50000, inputs.savings) } },
      { label: "Emergency fund → 6 months", patch: { emergencyFundMonths: Math.max(6, inputs.emergencyFundMonths) } },
      { label: "Job tenure → 24 months",    patch: { jobTenureMonths: Math.max(24, inputs.jobTenureMonths) } },
      { label: "All bills paid on time",    patch: { rentPayments: 3, utilityPayments: 3, telecomPayments: 3, subscriptionPayments: 3 } },
      { label: "Daily UPI usage",           patch: { digitalPaymentUsage: 5, transactionConsistency: 5 } },
    ];
    return presets.map(p => {
      const r = computeAssessment({ ...inputs, ...p.patch });
      return {
        label: p.label,
        from: baseline.overallScore,
        to: r.overallScore,
        delta: r.overallScore - baseline.overallScore,
      };
    }).filter(s => s.delta > 0.1);
  }, [inputs, baseline.overallScore]);

  return (
    <div className="card-elevated p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> What Improves My Score?
          </h2>
          <p className="text-xs text-muted-foreground">
            See the projected score for common improvements, or drag the sliders for a custom what-if.
          </p>
        </div>
        <button onClick={reset} className="rounded-md border border-border bg-surface-2/60 px-3 py-1 text-xs hover:bg-surface-2 cursor-pointer">
          Reset to current
        </button>
      </div>

      {scenarios.length > 0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Quick scenarios</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {scenarios.map(s => (
              <div key={s.label} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span>{s.label}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  <span className="text-muted-foreground">{Math.round(s.from)}</span>
                  <span>→</span>
                  <span className="font-bold text-success">{Math.round(s.to)}</span>
                  <span className="text-success">(+{Math.round(s.delta * 10) / 10})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <SliderRow label="Monthly Income" unit="₹" value={income} onChange={setIncome} min={0} max={300000} step={1000} baseline={inputs.monthlyIncome} />
          <SliderRow label="Savings" unit="₹" value={savings} onChange={setSavings} min={0} max={1000000} step={5000} baseline={inputs.savings} />
          <SliderRow label="Emergency Fund" unit=" mo" value={emergency} onChange={setEmergency} min={0} max={24} step={1} baseline={inputs.emergencyFundMonths} />
          <SliderRow label="Job Tenure" unit=" mo" value={tenure} onChange={setTenure} min={0} max={120} step={1} baseline={inputs.jobTenureMonths} />
        </div>

        <div className="space-y-4">
          <ProjectionCard title="Overall Score" baseline={baseline.overallScore} projected={projected.overallScore} delta={delta} />
          <ProjectionCard title="Confidence" baseline={baseline.confidenceScore} projected={projected.confidenceScore} delta={cdelta} suffix="%" />
          <div className="rounded-xl border border-border bg-surface-2/50 p-4 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Projected status</div>
            <div className="mt-1 font-semibold">{projected.eligibilityStatus}</div>
            <div className="mt-1 text-xs text-muted-foreground">Risk: {projected.riskLevel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, unit, value, onChange, min, max, step, baseline }: {
  label: string; unit: string; value: number; onChange: (n: number) => void;
  min: number; max: number; step: number; baseline: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular-nums">{unit === "₹" ? `₹${value.toLocaleString("en-IN")}` : `${value}${unit}`}</span>
      </div>
      <Slider value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={step} className="mt-2" />
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        Current: {unit === "₹" ? `₹${baseline.toLocaleString("en-IN")}` : `${baseline}${unit}`}
      </div>
    </div>
  );
}

function ProjectionCard({ title, baseline, projected, delta, suffix = "" }: {
  title: string; baseline: number; projected: number; delta: number; suffix?: string;
}) {
  const Icon = delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
  const color = delta > 0.05 ? "text-success" : delta < -0.05 ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="font-display text-2xl font-bold text-muted-foreground tabular-nums">{Math.round(baseline)}{suffix}</div>
        <div className="text-muted-foreground">→</div>
        <div className="font-display text-3xl font-bold text-gradient tabular-nums">{Math.round(projected)}{suffix}</div>
        <div className={`ml-auto flex items-center gap-1 text-sm font-semibold ${color}`}>
          <Icon className="h-4 w-4" />
          {delta > 0 ? "+" : ""}{Math.round(delta * 10) / 10}{suffix}
        </div>
      </div>
    </div>
  );
}
