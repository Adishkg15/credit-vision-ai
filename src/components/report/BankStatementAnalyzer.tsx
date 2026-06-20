import { useRef, useState } from "react";
import { Upload, FileText, Loader2, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area, CartesianGrid,
} from "recharts";
import { analyzeFile, type BankAnalysis } from "@/lib/bank-statement";

interface Props {
  declaredIncome: number;
  baseConfidence?: number;
  initialAnalysis?: BankAnalysis | null;
  onAnalysis?: (a: BankAnalysis | null) => void;
  compact?: boolean;
}

export function BankStatementAnalyzer({ declaredIncome, baseConfidence = 0, initialAnalysis = null, onAnalysis, compact = false }: Props) {
  const [analysis, setAnalysis] = useState<BankAnalysis | null>(initialAnalysis);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const a = await analyzeFile(file, declaredIncome);
      setAnalysis(a);
      onAnalysis?.(a);
      toast.success(`Statement analysed: ${a.txnCount} transactions, ${a.monthsCovered} months`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to analyse file");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clear() {
    setAnalysis(null);
    onAnalysis?.(null);
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Bank Statement Analyser
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Optional. Upload a PDF or CSV bank statement to verify your claims.
            This only improves confidence and verification quality — it never raises risk on its own.
          </p>
        </div>
        {analysis && (
          <Button variant="ghost" size="sm" onClick={() => setAnalysis(null)}>
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {!analysis && (
        <div className="mt-5">
          <label
            htmlFor="bank-stmt-file"
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-2/30 p-8 text-center transition hover:border-primary/50 hover:bg-surface-2/60 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? (
              <><Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="mt-3 text-sm font-medium">Analysing statement…</p>
                <p className="text-xs text-muted-foreground">Parsing transactions and computing signals</p></>
            ) : (
              <><Upload className="h-6 w-6 text-primary" />
                <p className="mt-3 text-sm font-medium">Click to upload bank statement</p>
                <p className="text-xs text-muted-foreground">PDF or CSV • Max 15 MB • Processed locally in your browser</p></>
            )}
            <input
              ref={inputRef}
              id="bank-stmt-file"
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
          </label>
        </div>
      )}

      {analysis && <Results a={analysis} baseConfidence={baseConfidence} />}
    </div>
  );
}

function Results({ a, baseConfidence }: { a: BankAnalysis; baseConfidence: number }) {
  const adjusted = Math.max(0, Math.min(100, baseConfidence + a.confidenceAdjustment));
  const matchTone = a.matchQuality >= 80 ? "success" : a.matchQuality >= 60 ? "info" : "warning";
  return (
    <div className="mt-6 space-y-6">
      {/* Source */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 p-3 text-xs">
        <FileText className="h-4 w-4 text-primary" />
        <span className="font-medium">{a.fileName}</span>
        <span className="text-muted-foreground">• {a.source.toUpperCase()}</span>
        <span className="text-muted-foreground">• {a.txnCount} txns</span>
        <span className="text-muted-foreground">• {a.dateRange.from} → {a.dateRange.to}</span>
      </div>

      {/* Headline scores */}
      <div className="grid gap-3 md:grid-cols-3">
        <ScoreTile label="Banking Health" value={a.bankingHealthScore} icon={<TrendingUp className="h-4 w-4" />} />
        <ScoreTile label="Verification Score" value={a.verificationScore} icon={<ShieldCheck className="h-4 w-4" />} />
        <div className={`rounded-xl border p-4 ${matchTone === "success" ? "border-success/40 bg-success/10" : matchTone === "info" ? "border-info/40 bg-info/10" : "border-warning/40 bg-warning/10"}`}>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Match Quality</div>
          <div className="mt-1 font-display text-3xl font-semibold">{a.matchQuality}%</div>
          <div className="mt-1 text-xs text-muted-foreground">Declared vs verified</div>
        </div>
      </div>

      {/* Declared vs Verified */}
      <div className="rounded-xl border border-border bg-surface-2/40 p-5">
        <h3 className="text-sm font-semibold">Declared vs Verified Income</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Compare label="Declared" value={a.declaredIncome} tone="muted" />
          <Compare label="Verified (from statement)" value={a.verifiedIncome} tone="primary" />
          <div className="rounded-lg border border-border bg-surface-2/50 p-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Confidence shift</div>
            <div className={`mt-1 font-display text-2xl font-semibold ${a.confidenceAdjustment >= 0 ? "text-success" : "text-warning"}`}>
              {a.confidenceAdjustment >= 0 ? "+" : ""}{a.confidenceAdjustment.toFixed(1)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Confidence: {baseConfidence}% → <span className="font-semibold text-foreground">{adjusted.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Risk score is unchanged. Bank statements adjust verification confidence only — by design.
        </p>
      </div>

      {/* Extracted signals */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Signal label="Avg monthly balance" value={`₹${a.avgMonthlyBalance.toLocaleString("en-IN")}`} />
        <Signal label="Estimated income" value={`₹${a.estimatedMonthlyIncome.toLocaleString("en-IN")}`} />
        <Signal label="Income consistency" value={`${a.incomeConsistency}%`} />
        <Signal label="Cash flow stability" value={`${a.cashFlowStability}%`} />
        <Signal label="Savings behaviour" value={`${a.savingsBehaviour}%`} />
        <Signal label="Txn volume / month" value={`${a.monthlyTxnVolume}`} />
        <Signal label="Bounced items" value={`${a.bouncedCount}`} tone={a.bouncedCount > 0 ? "warning" : "default"} />
        <Signal label="Overdraft events" value={`${a.overdraftCount}`} tone={a.overdraftCount > 0 ? "warning" : "default"} />
      </div>

      {/* Verified Financial Insights */}
      <div className="rounded-xl border border-border bg-surface-2/30 p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <CheckCircle2 className="h-4 w-4 text-success" /> Verified Financial Insights
        </h3>
        <p className="text-xs text-muted-foreground">Drawn directly from your uploaded statement</p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ChartCard title="Monthly cash flow">
            <ResponsiveContainer>
              <BarChart data={a.monthly}>
                <CartesianGrid stroke="oklch(0.28 0.02 260)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 11 }} />
                <YAxis tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.02 260)", border: "1px solid oklch(0.30 0.02 260)", borderRadius: 8, color: "oklch(0.95 0 0)" }} />
                <Bar dataKey="income" name="Income" fill="oklch(0.78 0.16 180)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="oklch(0.70 0.22 25)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Balance trend">
            <ResponsiveContainer>
              <AreaChart data={a.monthly}>
                <defs>
                  <linearGradient id="balG" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 180)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 180)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.02 260)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 11 }} />
                <YAxis tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.02 260)", border: "1px solid oklch(0.30 0.02 260)", borderRadius: 8, color: "oklch(0.95 0 0)" }} />
                <Area type="monotone" dataKey="endBalance" name="End balance" stroke="oklch(0.78 0.16 180)" fill="url(#balG)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Net savings per month">
            <ResponsiveContainer>
              <LineChart data={a.monthly}>
                <CartesianGrid stroke="oklch(0.28 0.02 260)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 11 }} />
                <YAxis tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.02 260)", border: "1px solid oklch(0.30 0.02 260)", borderRadius: 8, color: "oklch(0.95 0 0)" }} />
                <Line type="monotone" dataKey="net" name="Net flow" stroke="oklch(0.70 0.22 295)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Income stability">
            <ResponsiveContainer>
              <BarChart data={a.monthly}>
                <CartesianGrid stroke="oklch(0.28 0.02 260)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 11 }} />
                <YAxis tick={{ fill: "oklch(0.7 0.02 255)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.02 260)", border: "1px solid oklch(0.30 0.02 260)", borderRadius: 8, color: "oklch(0.95 0 0)" }} />
                <Bar dataKey="income" name="Income" fill="oklch(0.74 0.17 152)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="mt-5 rounded-lg border border-info/30 bg-info/10 p-4 text-sm text-info">
          <div className="flex items-start gap-2">
            {a.confidenceAdjustment >= 0
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <p>{a.summary}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold text-gradient">{value}</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-[image:var(--gradient-brand)]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Compare({ label, value, tone }: { label: string; value: number; tone: "muted" | "primary" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${tone === "primary" ? "text-gradient" : ""}`}>
        ₹{value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}

function Signal({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "warning" ? "border-warning/40 bg-warning/10" : "border-border bg-surface-2/40"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
      <div className="mt-3 h-56">{children}</div>
    </div>
  );
}
