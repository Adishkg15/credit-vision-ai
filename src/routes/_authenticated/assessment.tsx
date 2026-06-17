import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { computeAssessment, EMPTY_INPUTS, type AssessmentInputs } from "@/lib/scoring";
import { supabase } from "@/integrations/supabase/client";
import { NumberField } from "@/components/NumberField";

export const Route = createFileRoute("/_authenticated/assessment")({
  head: () => ({ meta: [{ title: "New assessment — CreditVision AI" }] }),
  component: Wizard,
});

const STEPS = [
  { id: 1, title: "Personal", desc: "Identity & background" },
  { id: 2, title: "Financial", desc: "Income, savings, assets" },
  { id: 3, title: "Banking", desc: "Bank behaviour & flow" },
  { id: 4, title: "Bills", desc: "Payment regularity" },
  { id: 5, title: "Employment", desc: "Job quality & growth" },
  { id: 6, title: "Review", desc: "Confirm & score" },
];

function ScaleField({ label, value, onChange, low = "Low", high = "High" }: {
  label: string; value: number; onChange: (v: number) => void; low?: string; high?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        <span className="text-sm font-semibold text-primary">{value} / 5</span>
      </div>
      <Slider min={1} max={5} step={1} value={[value]} onValueChange={v => onChange(v[0])} />
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

function BillField({ label, value, onChange }: { label: string; value: number; onChange: (v: -1 | 0 | 1 | 2 | 3) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={String(value)} onValueChange={v => onChange(Number(v) as -1 | 0 | 1 | 2 | 3)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="-1">Not applicable</SelectItem>
          <SelectItem value="0">I don't pay this</SelectItem>
          <SelectItem value="1">Often late</SelectItem>
          <SelectItem value="2">Sometimes late</SelectItem>
          <SelectItem value="3">Always on time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function Wizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<AssessmentInputs>(EMPTY_INPUTS);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof AssessmentInputs>(k: K, v: AssessmentInputs[K]) => setData(d => ({ ...d, [k]: v }));

  const isStudent = data.employmentType === "student";

  async function submit() {
    if (!data.name.trim()) { toast.error("Applicant name required"); setStep(1); return; }
    setSaving(true);
    try {
      const result = computeAssessment(data);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { data: row, error } = await supabase.from("assessments").insert({
        user_id: user.user.id,
        inputs: data as never,
        result: result as never,
        overall_score: result.overallScore,
        confidence_score: result.confidenceScore,
        risk_level: result.riskLevel,
        eligibility_status: result.eligibilityStatus,
        applicant_name: data.name,
        status: "completed",
      }).select("id").single();
      if (error) throw error;
      toast.success("Assessment complete");
      navigate({ to: "/report/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Assessment</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">New credit assessment</h1>
        </div>
        <div className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</div>
      </div>

      <div className="mt-6 card-elevated p-4">
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {STEPS.map(s => (
            <button key={s.id}
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition
                ${step === s.id ? "bg-primary text-primary-foreground" : step > s.id ? "bg-success/15 text-success" : "bg-surface-2 text-muted-foreground"}`}>
              {step > s.id ? <Check className="h-3 w-3" /> : <span className="font-semibold">{s.id}</span>}
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 card-elevated p-6 md:p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold">{STEPS[step - 1].title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[step - 1].desc}</p>
        </div>

        {step === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={data.name} onChange={e => set("name", e.target.value)} placeholder="Your legal name" /></div>
            <NumberField label="Age" value={data.age} onChange={v => set("age", v)} min={16} max={99} />
            <div className="space-y-1.5"><Label>City</Label><Input value={data.city} onChange={e => set("city", e.target.value)} placeholder="Mumbai" /></div>
            <div className="space-y-1.5">
              <Label>Education</Label>
              <Select value={data.education} onValueChange={v => set("education", v as AssessmentInputs["education"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_school">High School</SelectItem>
                  <SelectItem value="diploma">Diploma</SelectItem>
                  <SelectItem value="bachelors">Bachelor's</SelectItem>
                  <SelectItem value="masters">Master's</SelectItem>
                  <SelectItem value="phd">PhD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Institution tier</Label>
              <Select value={String(data.institutionTier)} onValueChange={v => set("institutionTier", Number(v) as 1 | 2 | 3)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tier 1 — IIT/IIM/Top global</SelectItem>
                  <SelectItem value="2">Tier 2 — Reputed national</SelectItem>
                  <SelectItem value="3">Tier 3 — Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Borrower type</Label>
              <Select value={data.employmentType} onValueChange={v => set("employmentType", v as AssessmentInputs["employmentType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="fresher">Fresher</SelectItem>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="self_employed">Self-employed</SelectItem>
                  <SelectItem value="gig_worker">Gig worker</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberField label="Certifications" value={data.certifications} onChange={v => set("certifications", v)} />
            <NumberField label="Internships completed" value={data.internships} onChange={v => set("internships", v)} />
            {!isStudent && (
              <NumberField label="Work experience" value={data.workExperienceYears} onChange={v => set("workExperienceYears", v)} suffix="years" step={0.5} />
            )}

            {isStudent && (
              <>
                <div className="md:col-span-2 mt-2 rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info">
                  Student profile selected — we'll evaluate you on academics, internships, placement and family support instead of salary.
                </div>
                <div className="space-y-1.5">
                  <Label>College name</Label>
                  <Input value={data.collegeName ?? ""} onChange={e => set("collegeName", e.target.value)} placeholder="e.g. IIT Bombay" />
                </div>
                <NumberField label="Graduation year" value={data.graduationYear ?? 0} onChange={v => set("graduationYear", v)} min={2000} max={2040} />
                <div className="space-y-1.5">
                  <Label>Placement status</Label>
                  <Select value={data.placementStatus ?? "not_started"} onValueChange={v => set("placementStatus", v as AssessmentInputs["placementStatus"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="placed">Placed</SelectItem>
                      <SelectItem value="in_process">In process</SelectItem>
                      <SelectItem value="not_started">Not started</SelectItem>
                      <SelectItem value="na">Not applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Offer letter available?</Label>
                  <Select value={data.offerLetter ? "yes" : "no"} onValueChange={v => set("offerLetter", v === "yes")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField label="Expected monthly salary" value={data.expectedSalary ?? 0} onChange={v => set("expectedSalary", v)} prefix="₹" placeholder="e.g. 60000" />
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            {!isStudent && (
              <NumberField label="Monthly income" value={data.monthlyIncome} onChange={v => set("monthlyIncome", v)} prefix="₹" />
            )}
            <NumberField label="Monthly expenses" value={data.monthlyExpenses} onChange={v => set("monthlyExpenses", v)} prefix="₹" />
            <NumberField label="Total savings" value={data.savings} onChange={v => set("savings", v)} prefix="₹" />
            <NumberField label="Emergency fund" value={data.emergencyFundMonths} onChange={v => set("emergencyFundMonths", v)} suffix="months of expenses" />
            <NumberField label="Investments" value={data.investments} onChange={v => set("investments", v)} prefix="₹" />
            <NumberField label="Other assets value" value={data.assets} onChange={v => set("assets", v)} prefix="₹" />
            <NumberField label="Dependents" value={data.dependents} onChange={v => set("dependents", v)} />

            {isStudent && (
              <>
                <div className="space-y-1.5">
                  <Label>Family financial support</Label>
                  <Select value={data.familySupport ? "yes" : "no"} onValueChange={v => set("familySupport", v === "yes")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — supported by family</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField label="Scholarship (monthly)" value={data.scholarshipAmount ?? 0} onChange={v => set("scholarshipAmount", v)} prefix="₹" />
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 md:grid-cols-2">
            <NumberField label="Average bank balance" value={data.avgBankBalance} onChange={v => set("avgBankBalance", v)} prefix="₹" />
            <NumberField label="Monthly transactions" value={data.monthlyTransactions} onChange={v => set("monthlyTransactions", v)} />
            <ScaleField label="Transaction consistency" value={data.transactionConsistency} onChange={v => set("transactionConsistency", v as 1 | 2 | 3 | 4 | 5)} low="Erratic" high="Very steady" />
            <ScaleField label="Digital payment usage" value={data.digitalPaymentUsage} onChange={v => set("digitalPaymentUsage", v as 1 | 2 | 3 | 4 | 5)} low="Rarely" high="Daily" />
            <NumberField label="Failed transactions (last 3 mo)" value={data.failedTransactions} onChange={v => set("failedTransactions", v)} />
            <NumberField label="Overdraft events (last 12 mo)" value={data.overdraftEvents} onChange={v => set("overdraftEvents", v)} />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5 md:grid-cols-2">
            <BillField label="Rent payments" value={data.rentPayments} onChange={v => set("rentPayments", v)} />
            <BillField label="Utility bills (electricity, water, gas)" value={data.utilityPayments} onChange={v => set("utilityPayments", v)} />
            <BillField label="Telecom / internet" value={data.telecomPayments} onChange={v => set("telecomPayments", v)} />
            <BillField label="Subscriptions (OTT, SaaS)" value={data.subscriptionPayments} onChange={v => set("subscriptionPayments", v)} />
            <p className="md:col-span-2 rounded-lg bg-info/10 p-3 text-xs text-info">
              Not paying a bill (e.g. you don't pay rent) does <b>not</b> reduce your score. We only lower confidence
              when we have no signal at all.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-5 md:grid-cols-2">
            {isStudent ? (
              <div className="md:col-span-2 rounded-lg border border-info/30 bg-info/10 p-4 text-sm text-info">
                Employer / job tenure / salary questions are skipped for student profiles. We use your placement,
                offer letter and expected salary instead — captured in Step 1.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={data.industry} onValueChange={v => set("industry", v as AssessmentInputs["industry"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tech">Technology</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="creative">Creative / Media</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="na">Not applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField label="Tenure at current job" value={data.jobTenureMonths} onChange={v => set("jobTenureMonths", v)} suffix="months" />
                <NumberField label="Annual salary growth" value={data.salaryGrowthPct} onChange={v => set("salaryGrowthPct", v)} suffix="%" step={0.5} />
                <NumberField label="Promotions received" value={data.promotions} onChange={v => set("promotions", v)} />
                <ScaleField label="Employer stability" value={data.employerStability} onChange={v => set("employerStability", v as 1 | 2 | 3 | 4 | 5)} low="Startup / new" high="Blue chip" />
              </>
            )}
          </div>
        )}

        {step === 6 && (
          <ReviewStep data={data} />
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length ? (
            <Button onClick={() => setStep(s => Math.min(STEPS.length, s + 1))} className="bg-[image:var(--gradient-brand)] text-primary-foreground btn-glow hover:opacity-90">
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving} className="bg-[image:var(--gradient-brand)] text-primary-foreground btn-glow hover:opacity-90">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scoring…</> : <>Generate report <ArrowRight className="ml-1 h-4 w-4" /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ data }: { data: AssessmentInputs }) {
  const r = computeAssessment(data);
  const isStudent = data.employmentType === "student";
  const rows: [string, string | number][] = [
    ["Applicant", data.name || "—"],
    ["Borrower type", data.employmentType],
    ...(isStudent
      ? [
          ["College", data.collegeName || "—"] as [string, string],
          ["Placement", data.placementStatus ?? "—"] as [string, string],
          ["Offer letter", data.offerLetter ? "Yes" : "No"] as [string, string],
          ["Expected salary", `₹${(data.expectedSalary ?? 0).toLocaleString("en-IN")}`] as [string, string],
        ]
      : [
          ["Monthly income", `₹${data.monthlyIncome.toLocaleString("en-IN")}`] as [string, string],
          ["Job tenure", `${data.jobTenureMonths} mo`] as [string, string],
        ]),
    ["Monthly expenses", `₹${data.monthlyExpenses.toLocaleString("en-IN")}`],
    ["Savings", `₹${data.savings.toLocaleString("en-IN")}`],
    ["Average bank balance", `₹${data.avgBankBalance.toLocaleString("en-IN")}`],
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface-2/50 p-5">
        <h3 className="text-sm font-semibold">Inputs summary</h3>
        <dl className="mt-4 space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-xl border border-border bg-surface-2/50 p-5">
        <h3 className="text-sm font-semibold">Preview</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Overall</div>
            <div className="font-display text-4xl font-semibold text-gradient">{r.overallScore}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className="font-display text-4xl font-semibold">{r.confidenceScore}%</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Mini label="Future" value={r.advanced.futurePotential} />
          <Mini label="Discipline" value={r.advanced.financialDiscipline} />
          <Mini label="Trust" value={r.advanced.trust} />
        </div>
        <div className="mt-4 text-center">
          <div className="text-xs text-muted-foreground">Eligibility</div>
          <div className="mt-1 inline-flex rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">{r.eligibilityStatus}</div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Click <b>Generate report</b> to save and view full breakdown.</p>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-semibold">{Math.round(value)}</div>
    </div>
  );
}
