import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AssessmentResult, AssessmentInputs, LoanRecommendation, VerificationStatus } from "@/lib/scoring";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft, Download, FileCheck2, AlertTriangle, CheckCircle2,
  Wallet, CreditCard, TrendingUp, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { AIInsights } from "@/components/report/AIInsights";
import { BankStatementAnalyzer } from "@/components/report/BankStatementAnalyzer";
import { LenderView } from "@/components/report/LenderView";
import { downloadPdfReport } from "@/lib/pdf-report";

type AssessmentRow = {
  id: string; created_at: string; applicant_name: string | null;
  inputs: AssessmentInputs; result: AssessmentResult;
};

const opts = (id: string) => queryOptions({
  queryKey: ["assessment", id],
  queryFn: async (): Promise<AssessmentRow> => {
    const { data, error } = await supabase
      .from("assessments")
      .select("id, created_at, applicant_name, inputs, result")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data as unknown as AssessmentRow;
  },
});

export const Route = createFileRoute("/_authenticated/report/$id")({
  head: () => ({ meta: [{ title: "Report — Credit Vision" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  component: ReportPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Report not found.</div>,
});

function ReportPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const r = data.result;
  const applicantName = data.applicant_name || data.inputs.name || "Applicant";
  const [lenderMode, setLenderMode] = useState(false);
  const handlePdf = () => downloadPdfReport({ applicantName, inputs: data.inputs, result: r });

  const verification = r.verification ?? {
    status: "Self Reported" as VerificationStatus,
    verificationScore: 0, bankingHealthScore: 0, incomeMatchPct: 0,
    declaredIncome: data.inputs.monthlyIncome ?? 0, verifiedIncome: 0,
    statementPeriod: "Not provided", hasBankStatement: false, incomeMismatchFlag: false,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
        <div className="flex items-center gap-2">
          <Button
            variant={lenderMode ? "default" : "outline"}
            size="sm"
            onClick={() => setLenderMode(v => !v)}
          >
            <Eye className="mr-1 h-4 w-4" /> {lenderMode ? "Applicant View" : "Lender View"}
          </Button>
          <Button size="sm" onClick={handlePdf}><Download className="mr-1 h-4 w-4" /> Export PDF</Button>
        </div>
      </div>

      {/* Hero — always visible */}
      <ExecutiveSummary
        applicantName={applicantName}
        r={r}
        verificationStatus={verification.status}
        createdAt={data.created_at}
      />

      {verification.incomeMismatchFlag && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Income mismatch flag</p>
            <p className="mt-1 text-xs">
              Declared monthly income (₹{verification.declaredIncome.toLocaleString("en-IN")}) differs from verified bank income
              (₹{verification.verifiedIncome.toLocaleString("en-IN")}) by more than 20%. Recommend manual review.
            </p>
          </div>
        </div>
      )}

      {lenderMode ? (
        <div className="mt-8 space-y-6">
          <LenderView applicant={applicantName} inputs={data.inputs} result={r} />
          <Recommendations r={r} />
          <VerificationSummaryCard v={verification} compact />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="mt-8">
          <TabsList className="h-10 w-full justify-start gap-1 rounded-xl bg-surface-2/60 p-1">
            <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
            <TabsTrigger value="recommendations" className="px-4">Recommendations</TabsTrigger>
            <TabsTrigger value="ai" className="px-4">AI Insights</TabsTrigger>
            <TabsTrigger value="verification" className="px-4">Verification</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <KeyMetrics r={r} />
            <ScoreBreakdownRadar r={r} />
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <Recommendations r={r} />
          </TabsContent>

          <TabsContent value="ai" className="mt-6">
            <AIInsights inputs={data.inputs} result={r} />
          </TabsContent>

          <TabsContent value="verification" className="mt-6 space-y-6">
            <VerificationSummaryCard v={verification} />
            <div className="card-elevated p-6">
              <h3 className="font-display text-base font-semibold">Statement upload</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload or re-upload a bank statement to refresh verification signals.
              </p>
              <div className="mt-4">
                <BankStatementAnalyzer
                  declaredIncome={data.inputs.monthlyIncome ?? 0}
                  baseConfidence={r.confidenceScore}
                  initialAnalysis={data.inputs.bankAnalysis ?? null}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Generated from inputs you provided. Risk and confidence are independent. Missing data lowers confidence, never risk.
      </p>
    </div>
  );
}

/* ====================================================
   Executive Summary
   ==================================================== */
function ExecutiveSummary({ applicantName, r, verificationStatus, createdAt }: {
  applicantName: string; r: AssessmentResult; verificationStatus: VerificationStatus; createdAt: string;
}) {
  return (
    <div className="mt-6 card-elevated overflow-hidden">
      <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-10">
        <div className="pointer-events-none absolute inset-0 [background:var(--gradient-glow)]" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Executive Summary</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">{applicantName}</h1>
          <p className="mt-2 text-xs text-muted-foreground">Generated {new Date(createdAt).toLocaleString()}</p>

          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-4">
            <Stat label="Risk Level" value={r.riskLevel} tone={riskTone(r.riskLevel)} />
            <Stat label="Eligibility" value={r.eligibilityStatus} tone={eligTone(r.eligibilityStatus)} />
            <Stat label="Confidence" value={`${Math.round(r.confidenceScore)}%`} />
            <Stat label="Verification" value={verificationStatus} tone={verifTone(verificationStatus)} />
          </div>
        </div>
        <div className="relative grid place-items-center">
          <ScoreDial score={r.overallScore} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "info" | "warning" | "destructive" }) {
  const color =
    tone === "success" ? "text-success"
    : tone === "info" ? "text-info"
    : tone === "warning" ? "text-warning"
    : tone === "destructive" ? "text-destructive"
    : "text-foreground";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-xl font-semibold leading-tight ${color}`}>{value}</p>
    </div>
  );
}

/* ====================================================
   Key Metrics
   ==================================================== */
function KeyMetrics({ r }: { r: AssessmentResult }) {
  const wanted = ["financial", "banking", "employment", "bills"];
  const cats = wanted
    .map(k => r.categories.find(c => c.key === k))
    .filter((c): c is NonNullable<typeof c> => !!c);
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cats.map(c => (
        <div key={c.key} className="card-elevated p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{c.label}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-gradient">{Math.round(c.score)}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[image:var(--gradient-brand)]" style={{ width: `${c.score}%` }} />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Confidence {Math.round(c.confidence)}%</p>
        </div>
      ))}
    </div>
  );
}

/* ====================================================
   Radar
   ==================================================== */
function ScoreBreakdownRadar({ r }: { r: AssessmentResult }) {
  const radarData = r.categories.map(c => ({ subject: c.label, A: c.score, fullMark: 100 }));
  return (
    <div className="card-elevated p-6 md:p-8">
      <h2 className="font-display text-lg font-semibold">Score breakdown</h2>
      <p className="text-xs text-muted-foreground">Six-factor view of your credit profile.</p>
      <div className="mt-4 h-[380px] w-full md:h-[420px]">
        <ResponsiveContainer>
          <RadarChart data={radarData} margin={{ top: 24, right: 60, bottom: 24, left: 60 }} outerRadius="78%">
            <PolarGrid stroke="oklch(0.35 0.02 260)" />
            <PolarAngleAxis dataKey="subject" tick={<WrappedAxisTick />} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "oklch(0.6 0.02 255)", fontSize: 10 }} />
            <Radar dataKey="A" stroke="oklch(0.78 0.16 180)" fill="oklch(0.78 0.16 180)" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WrappedAxisTick(props: {
  x?: number; y?: number; payload?: { value: string }; textAnchor?: "end" | "inherit" | "middle" | "start";
}) {
  const { x = 0, y = 0, payload, textAnchor = "middle" } = props;
  const value = payload?.value ?? "";
  const words = value.split(" ");
  const lines: string[] = [];
  let line: string[] = [];
  for (const w of words) {
    line.push(w);
    if (line.join(" ").length >= 12) { lines.push(line.join(" ")); line = []; }
  }
  if (line.length) lines.push(line.join(" "));
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="oklch(0.85 0.02 255)" fontSize={11}>
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>{ln}</tspan>
      ))}
    </text>
  );
}

/* ====================================================
   Recommendations
   ==================================================== */
function Recommendations({ r }: { r: AssessmentResult }) {
  const card = r.recommendations.find(x => /credit card/i.test(x.product));
  const loan = r.recommendations.find(x => /personal loan/i.test(x.product))
    ?? r.recommendations.find(x => /education loan/i.test(x.product))
    ?? r.recommendations.find(x => x.eligible && !/credit card/i.test(x.product));
  const featured: LoanRecommendation[] = [card, loan].filter((x): x is LoanRecommendation => !!x);
  const rateProduct = loan ?? card;
  return (
    <div className="card-elevated p-6 md:p-8">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Recommendations</h2>
      </div>
      <p className="text-xs text-muted-foreground">Derived from your score and capacity.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {featured.map(rec => <RecCard key={rec.product} rec={rec} />)}
        <div className="rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Suggested Interest Band</div>
          <div className="mt-4 font-display text-3xl font-semibold text-gradient">
            {rateProduct && rateProduct.interestRange[1] > 0
              ? `${rateProduct.interestRange[0]}–${rateProduct.interestRange[1]}%`
              : "—"}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Risk-priced band for unsecured borrowing at this score and confidence.
          </p>
        </div>
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: LoanRecommendation }) {
  const ineligible = !rec.eligible;
  const icon = /credit card/i.test(rec.product) ? <CreditCard className="h-4 w-4 text-primary" /> : <Wallet className="h-4 w-4 text-primary" />;
  return (
    <div className={`rounded-xl border p-5 ${ineligible ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface-2/40"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">{icon}{rec.product}</div>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${ineligible ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
          {ineligible ? "Not eligible" : "Eligible"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <MiniStat label="Approval" value={`${rec.approvalProbability}%`} />
        <MiniStat label="Amount" value={rec.recommendedAmount > 0 ? `₹${rec.recommendedAmount.toLocaleString("en-IN")}` : "—"} />
        <MiniStat label="Rate" value={rec.interestRange[1] > 0 ? `${rec.interestRange[0]}–${rec.interestRange[1]}%` : "—"} />
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-[image:var(--gradient-brand)]" style={{ width: `${rec.approvalProbability}%` }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{rec.rationale}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

/* ====================================================
   Verification
   ==================================================== */
function VerificationSummaryCard({ v, compact = false }: { v: NonNullable<AssessmentResult["verification"]>; compact?: boolean }) {
  const tone = verifTone(v.status);
  const ring =
    tone === "success" ? "border-success/40 bg-success/5"
    : tone === "info" ? "border-info/40 bg-info/5"
    : "border-warning/40 bg-warning/5";
  const Icon = v.hasBankStatement ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`rounded-xl border ${ring} p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Verification Summary</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold
          ${tone === "success" ? "bg-success/15 text-success" : tone === "info" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
          <Icon className="h-3.5 w-3.5" /> {v.status}
        </span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <VStat label="Income Match" value={v.hasBankStatement ? `${Math.round(v.incomeMatchPct)}%` : "—"} />
        <VStat label="Verification Score" value={v.hasBankStatement ? `${Math.round(v.verificationScore)}/100` : "—"} />
        <VStat label="Banking Health" value={v.hasBankStatement ? `${Math.round(v.bankingHealthScore)}/100` : "—"} />
        <VStat label="Statement Period" value={v.statementPeriod} />
      </div>
      {!compact && !v.hasBankStatement && (
        <p className="mt-4 text-xs text-muted-foreground">
          No bank statement on file. This reduces confidence — never risk. Upload one below to raise verification.
        </p>
      )}
    </div>
  );
}

function VStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold">{value}</p>
    </div>
  );
}

/* ====================================================
   Helpers
   ==================================================== */
function riskTone(level: string): "success" | "info" | "warning" | "destructive" {
  if (level === "Low") return "success";
  if (level === "Moderate") return "info";
  if (level === "Elevated") return "warning";
  return "destructive";
}
function eligTone(s: string): "success" | "info" | "warning" | "destructive" {
  if (s === "Approved") return "success";
  if (s === "Conditional Approval") return "info";
  if (s === "Manual Review") return "warning";
  return "destructive";
}
function verifTone(s: VerificationStatus): "success" | "info" | "warning" {
  if (s === "Verified") return "success";
  if (s === "Partially Verified") return "info";
  return "warning";
}

function ScoreDial({ score }: { score: number }) {
  const radius = 70;
  const c = 2 * Math.PI * radius;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative grid h-52 w-52 place-items-center">
      <svg viewBox="0 0 180 180" className="-rotate-90">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.16 180)" />
            <stop offset="100%" stopColor="oklch(0.70 0.22 295)" />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={radius} stroke="oklch(0.28 0.02 260)" strokeWidth="14" fill="none" />
        <circle cx="90" cy="90" r={radius} stroke="url(#g)" strokeWidth="14" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-6xl font-bold text-gradient">{Math.round(score)}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Overall</div>
      </div>
    </div>
  );
}
