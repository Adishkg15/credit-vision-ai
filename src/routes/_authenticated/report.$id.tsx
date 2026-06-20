import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AssessmentResult, AssessmentInputs, LoanRecommendation } from "@/lib/scoring";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { ArrowLeft, ShieldCheck, Activity, Sparkles, Download, Users, User, ChevronDown, LayoutDashboard, Wallet, FileCheck2, BrainCircuit, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [view, setView] = useState<"applicant" | "lender">("applicant");
  const applicantName = data.applicant_name || data.inputs.name || "Applicant";

  const handlePdf = () => downloadPdfReport({ applicantName, inputs: data.inputs, result: r });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border bg-surface-2/60 p-1 text-xs">
            <button
              onClick={() => setView("applicant")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${view === "applicant" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              <User className="h-3.5 w-3.5" /> Applicant
            </button>
            <button
              onClick={() => setView("lender")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${view === "lender" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              <Users className="h-3.5 w-3.5" /> Lender
            </button>
          </div>
          <Button size="sm" onClick={handlePdf}><Download className="mr-1 h-4 w-4" /> Export PDF</Button>
        </div>
      </div>

      {/* Executive Summary — always visible, both views */}
      <ExecutiveSummary applicantName={applicantName} r={r} createdAt={data.created_at} />

      {view === "lender" ? (
        <LenderModeBody r={r} inputs={data.inputs} applicantName={applicantName} />
      ) : (
        <ApplicantTabs r={r} data={data} />
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Generated from inputs you provided. Risk and confidence are independent.
      </p>
    </div>
  );
}

/* ============================================================
   Executive Summary — the single premium card at the top
   ============================================================ */
function ExecutiveSummary({ applicantName, r, createdAt }: {
  applicantName: string; r: AssessmentResult; createdAt: string;
}) {
  const recommendation =
    r.eligibilityStatus === "Approved" ? "Approve"
    : r.eligibilityStatus === "Conditional Approval" ? "Approve with conditions"
    : r.eligibilityStatus === "Manual Review" ? "Refer for manual review"
    : "Decline at this time";

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
            <Stat label="Recommendation" value={recommendation} tone={eligTone(r.eligibilityStatus)} />
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

/* ============================================================
   Applicant view — tabbed information architecture
   ============================================================ */
function ApplicantTabs({ r, data }: { r: AssessmentResult; data: AssessmentRow }) {
  const radarData = r.categories.map(c => ({ subject: c.label, A: c.score, fullMark: 100 }));
  const barData = r.categories.map(c => ({ name: c.label, score: c.score }));

  return (
    <Tabs defaultValue="overview" className="mt-8">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-surface-2/60 p-1 md:inline-flex md:w-auto">
        <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" /> Overview</TabsTrigger>
        <TabsTrigger value="recommendations" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Recommendations</TabsTrigger>
        <TabsTrigger value="verification" className="gap-1.5"><FileCheck2 className="h-3.5 w-3.5" /> Verification</TabsTrigger>
        <TabsTrigger value="insights" className="gap-1.5"><BrainCircuit className="h-3.5 w-3.5" /> AI Insights</TabsTrigger>
      </TabsList>

      {/* OVERVIEW */}
      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="card-elevated p-6 lg:col-span-2">
            <h2 className="font-display text-base font-semibold">Category radar</h2>
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
            <h2 className="font-display text-base font-semibold">Score distribution</h2>
            <p className="text-xs text-muted-foreground">Per category, out of 100</p>
            <div className="mt-3 h-72">
              <ResponsiveContainer>
                <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "oklch(0.6 0.02 255)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fill: "oklch(0.85 0.02 255)", fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "oklch(0.28 0.02 260 / 0.5)" }} contentStyle={{ background: "oklch(0.20 0.02 260)", border: "1px solid oklch(0.30 0.02 260)", borderRadius: 8, color: "oklch(0.95 0 0)" }} />
                  <Bar dataKey="score" name="Score" radius={[0, 6, 6, 0]}>
                    {barData.map((_, i) => <Cell key={i} fill="oklch(0.78 0.16 180)" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Meter title="Risk index" value={100 - r.overallScore} suffix="/ 100"
            icon={<ShieldCheck className="h-4 w-4" />}
            subtitle="Lower is better. Independent of confidence." tone="risk" />
          <Meter title="Confidence" value={r.confidenceScore} suffix="%"
            icon={<Activity className="h-4 w-4" />}
            subtitle="Data sufficiency. Missing data lowers this — not your score." tone="confidence" />
        </div>

        <AdvancedScores r={r} />

        {/* Collapsible advanced analytics */}
        <Section title="Explainable AI" subtitle="Factor-by-factor reasoning">
          <ExplainableAI r={r} />
        </Section>
        <Section title="Confidence Analysis" subtitle="What we have and what's missing">
          <ConfidenceAnalysis inputs={data.inputs} result={r} />
        </Section>
      </TabsContent>

      {/* RECOMMENDATIONS */}
      <TabsContent value="recommendations" className="mt-6 space-y-6">
        <div className="card-elevated p-6">
          <h2 className="font-display text-lg font-semibold">Lending recommendations</h2>
          <p className="text-xs text-muted-foreground">Derived from your inputs — never hard-coded.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {r.recommendations.map(rec => <RecCard key={rec.product} rec={rec} />)}
          </div>
        </div>

        <SimulatorPanel inputs={data.inputs} baseline={r} />
      </TabsContent>

      {/* VERIFICATION */}
      <TabsContent value="verification" className="mt-6">
        <BankStatementAnalyzer
          declaredIncome={data.inputs.monthlyIncome ?? 0}
          baseConfidence={r.confidenceScore}
        />
      </TabsContent>

      {/* AI INSIGHTS */}
      <TabsContent value="insights" className="mt-6">
        <AIAssessmentSummary inputs={data.inputs} result={r} />
      </TabsContent>
    </Tabs>
  );
}

/* ============================================================
   Lender view body — minimal, decision-grade
   ============================================================ */
function LenderModeBody({ r, inputs, applicantName }: {
  r: AssessmentResult; inputs: AssessmentInputs; applicantName: string;
}) {
  return (
    <div className="mt-8 space-y-6">
      <LenderView applicant={applicantName} inputs={inputs} result={r} />
      <div className="card-elevated p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <FileCheck2 className="h-4 w-4 text-primary" /> Verification
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Optional bank statement upload increases confidence — never risk.</p>
        <div className="mt-4">
          <BankStatementAnalyzer
            declaredIncome={inputs.monthlyIncome ?? 0}
            baseConfidence={r.confidenceScore}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AI Assessment Summary — merged narrative with tabs
   ============================================================ */
function AIAssessmentSummary({ inputs, result }: { inputs: AssessmentInputs; result: AssessmentResult }) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">AI Assessment Summary</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Summary, strengths, risks, missing information, and recommended actions — generated from your assessment.
      </p>
      <div className="mt-5">
        <AIInsights inputs={inputs} result={result} />
      </div>
    </div>
  );
}

/* ============================================================
   Improvement Simulator panel — hidden behind a button
   ============================================================ */
function SimulatorPanel({ inputs, baseline }: { inputs: AssessmentInputs; baseline: AssessmentResult }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="card-elevated flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Improvement Simulator</h3>
          <p className="text-xs text-muted-foreground">See how changes to income, savings, or behaviour move your score.</p>
        </div>
        <Button onClick={() => setOpen(true)}><PlayCircle className="mr-1.5 h-4 w-4" /> Run Improvement Simulation</Button>
      </div>
    );
  }
  return <WhatIfSimulator inputs={inputs} baseline={baseline} />;
}

/* ============================================================
   Collapsible section wrapper
   ============================================================ */
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2/40 px-5 py-4 text-left transition hover:bg-surface-2/70">
        <div>
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ============================================================
   Small primitives
   ============================================================ */
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

function RecCard({ rec }: { rec: LoanRecommendation }) {
  const ineligible = !rec.eligible;
  return (
    <div className={`rounded-xl border p-5 ${ineligible ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface-2/40"}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{rec.product}</h3>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${ineligible ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
          {ineligible ? "Not eligible" : "Eligible"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <MiniStat label="Approval" value={`${rec.approvalProbability}%`} />
        <MiniStat label="Amount" value={rec.recommendedAmount > 0 ? `₹${(rec.recommendedAmount).toLocaleString("en-IN")}` : "—"} />
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
