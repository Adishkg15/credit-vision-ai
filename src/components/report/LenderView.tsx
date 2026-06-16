import type { AssessmentInputs, AssessmentResult } from "@/lib/scoring";
import { Briefcase, ShieldCheck, Activity, AlertTriangle } from "lucide-react";

export function LenderView({ applicant, inputs, result }: {
  applicant: string; inputs: AssessmentInputs; result: AssessmentResult;
}) {
  const exposure = Math.max(...result.recommendations.map(r => r.recommendedAmount), 0);
  const topLoan = [...result.recommendations].sort((a, b) => b.recommendedAmount - a.recommendedAmount)[0];

  const decisionColor =
    result.eligibilityStatus === "Approved" ? "text-success"
    : result.eligibilityStatus === "Conditional Approval" ? "text-info"
    : result.eligibilityStatus === "Manual Review" ? "text-warning"
    : "text-destructive";

  return (
    <div className="card-elevated p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lender View — Underwriting Summary</p>
          <h2 className="font-display text-2xl font-bold">{applicant}</h2>
          <p className="text-xs text-muted-foreground">{inputs.employmentType.replace("_", " ")} · {inputs.city || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommendation</p>
          <p className={`font-display text-2xl font-bold ${decisionColor}`}>{result.eligibilityStatus}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Tile icon={<ShieldCheck className="h-4 w-4" />} label="Risk Level" value={result.riskLevel} sub={`Score ${Math.round(result.overallScore)}/100`} />
        <Tile icon={<Activity className="h-4 w-4" />} label="Confidence" value={`${Math.round(result.confidenceScore)}%`} sub={result.confidenceScore < 60 ? "Limited data" : "Adequate data"} />
        <Tile icon={<Briefcase className="h-4 w-4" />} label="Suggested Exposure" value={exposure > 0 ? `₹${exposure.toLocaleString("en-IN")}` : "₹0"} sub="Across products" />
        <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Missing Signals" value={String(result.missingInformation.length)} sub="Not counted as risk" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-2/50 p-4 lg:col-span-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Product matrix</div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left font-normal">Product</th><th className="text-right font-normal">Amount</th><th className="text-right font-normal">Rate</th><th className="text-right font-normal">Approval</th></tr>
            </thead>
            <tbody>
              {result.recommendations.map(r => (
                <tr key={r.product} className="border-t border-border/60">
                  <td className="py-2">{r.product}</td>
                  <td className="py-2 text-right tabular-nums">{r.eligible ? `₹${r.recommendedAmount.toLocaleString("en-IN")}` : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{r.interestRange[1] > 0 ? `${r.interestRange[0]}–${r.interestRange[1]}%` : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{r.approvalProbability}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border bg-surface-2/50 p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Suggested loan</div>
          <div className="mt-2 font-display text-xl font-bold">{topLoan?.product || "—"}</div>
          <div className="mt-1 font-semibold tabular-nums">{topLoan?.eligible ? `₹${topLoan.recommendedAmount.toLocaleString("en-IN")}` : "Not eligible"}</div>
          <div className="text-xs text-muted-foreground">Interest {topLoan?.interestRange[1] ? `${topLoan.interestRange[0]}–${topLoan.interestRange[1]}%` : "—"}</div>
          <p className="mt-3 text-xs text-muted-foreground">{topLoan?.rationale}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="text-sm font-semibold text-warning">Underwriter Notes — Concerns</div>
          {result.concerns.length === 0 ? (
            <p className="mt-2 text-xs italic text-muted-foreground">No concerns flagged.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {result.concerns.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-info/30 bg-info/10 p-4">
          <div className="text-sm font-semibold text-info">Documents to Request</div>
          {result.missingInformation.length === 0 ? (
            <p className="mt-2 text-xs italic text-muted-foreground">Profile is fully populated.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {result.missingInformation.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
