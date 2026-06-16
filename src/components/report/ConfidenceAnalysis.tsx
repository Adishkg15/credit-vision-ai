import { Activity, Check, X } from "lucide-react";
import type { AssessmentInputs, AssessmentResult } from "@/lib/scoring";

type Driver = { label: string; available: boolean; weight: number };

function buildDrivers(i: AssessmentInputs): Driver[] {
  return [
    { label: "Employment Data",     available: i.employmentType !== "unemployed" && i.jobTenureMonths >= 0, weight: 15 },
    { label: "Income Data",         available: i.monthlyIncome > 0, weight: 20 },
    { label: "Banking Activity",    available: i.monthlyTransactions > 0 || i.avgBankBalance > 0, weight: 15 },
    { label: "Savings & Reserves",  available: i.savings > 0 || i.emergencyFundMonths > 0, weight: 10 },
    { label: "Bill Payment Records", available: [i.rentPayments, i.utilityPayments, i.telecomPayments, i.subscriptionPayments].some(v => v > 0), weight: 10 },
    { label: "Education Profile",   available: !!i.education, weight: 8 },
    { label: "Bank Statement",      available: false, weight: 12 }, // not yet supported in v1
    { label: "Utility Records",     available: i.utilityPayments > 0, weight: 5 },
    { label: "Credit History",      available: false, weight: 5 }, // never counts as risk
  ];
}

export function ConfidenceAnalysis({ inputs, result }: { inputs: AssessmentInputs; result: AssessmentResult }) {
  const drivers = buildDrivers(inputs);
  const available = drivers.filter(d => d.available);
  const missing = drivers.filter(d => !d.available);

  const potential = Math.min(100, Math.round(result.confidenceScore + missing.reduce((s, d) => s + d.weight, 0)));

  return (
    <div className="card-elevated p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Activity className="h-4 w-4 text-primary" /> Confidence Analysis
          </h2>
          <p className="text-xs text-muted-foreground">
            How certain we are about the score — independent of risk.
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current</div>
            <div className="font-display text-2xl font-bold text-accent">{Math.round(result.confidenceScore)}%</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Potential</div>
            <div className="font-display text-2xl font-bold text-gradient">{potential}%</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <div className="text-sm font-semibold text-success">Available Signals</div>
          <ul className="mt-3 space-y-2 text-sm">
            {available.map(d => (
              <li key={d.label} className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-3 py-2">
                <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> {d.label}</span>
                <span className="text-xs text-muted-foreground">+{d.weight}</span>
              </li>
            ))}
            {available.length === 0 && <p className="text-xs italic text-muted-foreground">None available yet.</p>}
          </ul>
        </div>
        <div className="rounded-xl border border-info/30 bg-info/10 p-4">
          <div className="text-sm font-semibold text-info">Missing Signals (would lift confidence)</div>
          <ul className="mt-3 space-y-2 text-sm">
            {missing.map(d => (
              <li key={d.label} className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-3 py-2">
                <span className="flex items-center gap-2"><X className="h-3.5 w-3.5 text-info" /> {d.label}</span>
                <span className="text-xs text-muted-foreground">+{d.weight}%</span>
              </li>
            ))}
            {missing.length === 0 && <p className="text-xs italic text-muted-foreground">All signals captured.</p>}
          </ul>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            None of these reduce your risk score — they only limit certainty.
          </p>
        </div>
      </div>
    </div>
  );
}
