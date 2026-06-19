import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AssessmentResult, AssessmentInputs, LoanRecommendation, CategoryBreakdown } from "@/lib/scoring";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { CheckCircle2, AlertTriangle, Info, ArrowLeft, ShieldCheck, Activity, Sparkles, Download, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ExplainableAI } from "@/components/report/ExplainableAI";
import { ConfidenceAnalysis } from "@/components/report/ConfidenceAnalysis";
import { WhatIfSimulator } from "@/components/report/WhatIfSimulator";
import { LenderView } from "@/components/report/LenderView";
import { AdvancedScores } from "@/components/report/AdvancedScores";
import { AIInsights } from "@/components/report/AIInsights";
import { BankStatementAnalyzer } from "@/components/report/BankStatementAnalyzer";
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
  head: () => ({ meta: [{ title: "Report — CreditVision AI" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  component: ReportPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Report not found.</div>,
});

function ReportPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const r = data.result;

  const radarData = r.categories.map(c => ({ subject: c.label, A: c.score, fullMark: 100 }));
  const barData = r.categories.map(c => ({ name: c.label, score: c.score, confidence: c.confidence }));
  const [view, setView] = useState<"applicant" | "lender">("applicant");
  const applicantName = data.applicant_name || data.inputs.name || "Applicant";

  const handlePdf = () => {
    downloadPdfReport({ applicantName, inputs: data.inputs, result: r });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border bg-surface-2/60 p-1 text-xs">
            <button
              onClick={() => setView("applicant")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${view === "applicant" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              <User className="h-3.5 w-3.5" /> Applicant View
            </button>
            <button
              onClick={() => setView("lender")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${view === "lender" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              <Users className="h-3.5 w-3.5" /> Lender View
            </button>
          </div>
          <Button size="sm" onClick={handlePdf}><Download className="mr-1 h-4 w-4" /> Export PDF</Button>
          <div className="text-xs text-muted-foreground">Generated {new Date(data.created_at).toLocaleString()}</div>
        </div>
      </div>

      {view === "lender" ? (
        <>
          <div className="mt-6">
            <LenderView applicant={applicantName} inputs={data.inputs} result={r} />
          </div>
          <div className="mt-6">
            <BankStatementAnalyzer
              declaredIncome={data.inputs.monthlyIncome ?? 0}
              baseConfidence={r.confidenceScore}
            />
          </div>
        </>
      ) : (
        <ApplicantView r={r} data={data} radarData={radarData} barData={barData} />
      )}
    </div>
  );
}

function ApplicantView({ r, data, radarData, barData }: {
  r: AssessmentResult; data: AssessmentRow;
  radarData: { subject: string; A: number; fullMark: number }[];
  barData: { name: string; score: number; confidence: number }[];
}) {
  return (
    <>
      {/* Hero */}
      <div className="mt-6 card-elevated overflow-hidden">
        <div className="relative grid gap-6 p-8 md:grid-cols-3">
          <div className="pointer-events-none absolute inset-0 [background:var(--gradient-glow)]" />
          <div className="relative md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Assessment report</p>
            <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">{data.applicant_name || "Applicant"}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              A six-factor alternative credit profile. Risk and confidence are reported independently — missing information lowers confidence, not your score.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge tone={riskTone(r.riskLevel)}>Risk: {r.riskLevel}</Badge>
              <Badge tone={eligTone(r.eligibilityStatus)}>{r.eligibilityStatus}</Badge>
              <Badge tone="info">Confidence: {r.confidenceScore}%</Badge>
            </div>
          </div>
          <div className="relative grid place-items-center">
            <ScoreDial score={r.overallScore} />
          </div>
        </div>
      </div>

      {/* Meters */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Meter title="Risk meter" value={100 - r.overallScore} suffix="risk index"
          icon={<ShieldCheck className="h-4 w-4" />}
          subtitle="Lower is better. Derived from your score." tone="risk" />
        <Meter title="Confidence meter" value={r.confidenceScore} suffix="%"
          icon={<Activity className="h-4 w-4" />}
          subtitle="How much data we had to score you." tone="confidence" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="card-elevated p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Category radar</h2>
          <p className="text-xs text-muted-foreground">Six-factor breakdown</p>
          <div className="mt-3 h-72">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="oklch(0.35 0.02 260)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "oklch(0.78 0.02 255)", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "oklch(0.6 0.02 255)", fontSize: 10 }} />
                <Radar dataKey="A" stroke="oklch(0.78 0.16 180)" fill="oklch(0.78 0.16 180)" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-6 lg:col-span-3">
          <h2 className="font-display text-lg font-semibold">Score vs confidence</h2>
          <p className="text-xs text-muted-foreground">Per category</p>
          <div className="mt-3 h-72">
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 16 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "oklch(0.6 0.02 255)", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fill: "oklch(0.85 0.02 255)", fontSize: 11 }} />
                <Tooltip cursor={{ fill: "oklch(0.28 0.02 260 / 0.5)" }} contentStyle={{ background: "oklch(0.20 0.02 260)", border: "1px solid oklch(0.30 0.02 260)", borderRadius: 8, color: "oklch(0.95 0 0)" }} />
                <Bar dataKey="score" name="Score" radius={[0, 6, 6, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill="oklch(0.78 0.16 180)" />)}
                </Bar>
                <Bar dataKey="confidence" name="Confidence" radius={[0, 6, 6, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill="oklch(0.70 0.22 295 / 0.7)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mt-6 card-elevated p-6">
        <h2 className="font-display text-lg font-semibold">Category breakdown</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {r.categories.map(c => <CategoryCard key={c.key} c={c} />)}
        </div>
      </div>

      {/* Strengths / concerns / missing */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ListCard title="Strengths" items={r.strengths} icon={<CheckCircle2 className="h-4 w-4 text-success" />} empty="No standout strengths yet." />
        <ListCard title="Concerns" items={r.concerns} icon={<AlertTriangle className="h-4 w-4 text-warning" />} empty="No concerns flagged." />
        <ListCard title="Missing information" items={r.missingInformation} icon={<Info className="h-4 w-4 text-info" />} empty="Nothing missing — full picture." />
      </div>

      {/* AI Insights */}
      {r.insights.length > 0 && (
        <div className="mt-6 card-elevated p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Insights
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {r.insights.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface-2/50 p-3 text-muted-foreground">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div className="mt-6 card-elevated p-6">
        <h2 className="font-display text-lg font-semibold">Lending recommendations</h2>
        <p className="text-xs text-muted-foreground">Derived from your inputs — never hard-coded.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {r.recommendations.map(rec => <RecCard key={rec.product} rec={rec} />)}
        </div>
      </div>

      {/* Advanced scores (Future Potential, Financial Discipline, Trust) */}
      <div className="mt-6">
        <AdvancedScores r={r} />
      </div>

      {/* AI insights */}
      <div className="mt-6">
        <AIInsights inputs={data.inputs} result={r} />
      </div>

      {/* Explainable AI */}
      <div className="mt-6">
        <ExplainableAI r={r} />
      </div>

      {/* Confidence analysis */}
      <div className="mt-6">
        <ConfidenceAnalysis inputs={data.inputs} result={r} />
      </div>

      {/* What-if simulator */}
      <div className="mt-6">
        <WhatIfSimulator inputs={data.inputs} baseline={r} />
      </div>

      {/* Bank statement analyser (optional upload) */}
      <div className="mt-6">
        <BankStatementAnalyzer
          declaredIncome={data.inputs.monthlyIncome ?? 0}
          baseConfidence={r.confidenceScore}
        />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        This report is generated from inputs you provided. CreditVision AI evaluates capacity and behaviour, not credit history.
      </p>
    </>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "destructive" | "info" | "neutral" }) {
  const map: Record<string, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
    neutral: "bg-surface-2 text-muted-foreground",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

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

function ScoreDial({ score }: { score: number }) {
  const radius = 70;
  const c = 2 * Math.PI * radius;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative grid h-48 w-48 place-items-center">
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
        <div className="font-display text-5xl font-bold text-gradient">{Math.round(score)}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Overall score</div>
      </div>
    </div>
  );
}

function Meter({ title, value, suffix, subtitle, icon, tone }: {
  title: string; value: number; suffix: string; subtitle: string; icon: React.ReactNode; tone: "risk" | "confidence";
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = tone === "risk"
    ? "linear-gradient(90deg, oklch(0.74 0.17 152), oklch(0.80 0.16 80), oklch(0.65 0.23 25))"
    : "var(--gradient-brand)";
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
        <div className="font-semibold">{Math.round(value)}<span className="ml-1 text-xs text-muted-foreground">{suffix}</span></div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function CategoryCard({ c }: { c: CategoryBreakdown }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{c.label}</div>
        <div className="text-xs text-muted-foreground">Weight {c.weight}%</div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="font-display text-3xl font-semibold">{c.score}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Score / 100</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-accent">{c.confidence}%</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-[image:var(--gradient-brand)]" style={{ width: `${c.score}%` }} />
      </div>
      {c.notes.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{c.notes.join(" • ")}</p>}
    </div>
  );
}

function ListCard({ title, items, icon, empty }: { title: string; items: string[]; icon: React.ReactNode; empty: string }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      {items.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((it, i) => <li key={i} className="rounded-lg bg-surface-2/40 px-3 py-2 text-muted-foreground">{it}</li>)}
        </ul>
      )}
    </div>
  );
}

function RecCard({ rec }: { rec: LoanRecommendation }) {
  const ineligible = !rec.eligible;
  return (
    <div className={`rounded-xl border p-5 ${ineligible ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface-2/40"}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{rec.product}</h3>
        <Badge tone={ineligible ? "destructive" : "success"}>{ineligible ? "Not eligible" : "Eligible"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Approval" value={`${rec.approvalProbability}%`} />
        <Stat label="Amount" value={rec.recommendedAmount > 0 ? `₹${(rec.recommendedAmount).toLocaleString("en-IN")}` : "—"} />
        <Stat label="Rate" value={rec.interestRange[1] > 0 ? `${rec.interestRange[0]}–${rec.interestRange[1]}%` : "—"} />
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-[image:var(--gradient-brand)]" style={{ width: `${rec.approvalProbability}%` }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{rec.rationale}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Confidence {rec.confidence}%</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
