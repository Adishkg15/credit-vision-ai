import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, FilePlus2, TrendingUp, ShieldCheck, FileBarChart, Activity } from "lucide-react";

type Row = {
  id: string; created_at: string; overall_score: number | null;
  confidence_score: number | null; risk_level: string | null;
  eligibility_status: string | null; applicant_name: string | null; status: string;
};

const listOpts = queryOptions({
  queryKey: ["assessments", "list"],
  queryFn: async (): Promise<Row[]> => {
    const { data, error } = await supabase
      .from("assessments")
      .select("id, created_at, overall_score, confidence_score, risk_level, eligibility_status, applicant_name, status")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Credit Vision" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(listOpts),
  component: Dashboard,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function Dashboard() {
  const { data: rows } = useSuspenseQuery(listOpts);
  const completed = rows.filter(r => r.status === "completed");
  const total = rows.length;
  const reports = completed.length;
  const avg = completed.length
    ? Math.round((completed.reduce((s, r) => s + (r.overall_score ?? 0), 0) / completed.length) * 10) / 10
    : 0;

  const stats = [
    { label: "Total applications", value: total, icon: FilePlus2 },
    { label: "Completed assessments", value: completed.length, icon: ShieldCheck },
    { label: "Generated reports", value: reports, icon: FileBarChart },
    { label: "Average score", value: avg || "—", icon: TrendingUp },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Overview</p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl md:text-4xl">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Run a new alternative credit assessment or review past reports.</p>
        </div>
        <Link to="/assessment" className="shrink-0">
          <Button size="sm" className="bg-[image:var(--gradient-brand)] text-primary-foreground btn-glow hover:opacity-90 sm:size-default">
            <span className="hidden sm:inline">New assessment</span>
            <span className="sm:hidden">New</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="card-elevated p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 shrink-0 text-primary" />
            </div>
            <div className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 card-elevated p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">Recent activity</h2>
            <p className="text-sm text-muted-foreground">Your latest assessments and reports.</p>
          </div>
          <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {rows.length === 0 ? (
          <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">No assessments yet.</p>
            <Link to="/assessment" className="mt-3">
              <Button size="sm">Start your first assessment</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="mt-6 flex flex-col gap-3 md:hidden">
              {rows.slice(0, 10).map(r => (
                <Link
                  key={r.id}
                  to="/report/$id"
                  params={{ id: r.id }}
                  className="rounded-lg border border-border bg-surface/40 p-4 transition hover:bg-surface/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.applicant_name || "Unnamed applicant"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-xl font-semibold">{r.overall_score ?? "—"}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RiskPill level={r.risk_level} />
                    <EligPill status={r.eligibility_status} />
                    <span className="text-xs text-muted-foreground">Conf {r.confidence_score ?? "—"}%</span>
                    <span className="ml-auto text-xs font-medium text-primary">View →</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="mt-6 hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Applicant</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Score</th>
                    <th className="px-4 py-2.5">Confidence</th>
                    <th className="px-4 py-2.5">Risk</th>
                    <th className="px-4 py-2.5">Eligibility</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-surface/50">
                      <td className="px-4 py-3">{r.applicant_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-semibold">{r.overall_score ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.confidence_score ?? "—"}%</td>
                      <td className="px-4 py-3"><RiskPill level={r.risk_level} /></td>
                      <td className="px-4 py-3"><EligPill status={r.eligibility_status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link to="/report/$id" params={{ id: r.id }} className="text-primary hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RiskPill({ level }: { level: string | null }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const tone =
    level === "Low" ? "bg-success/15 text-success" :
    level === "Moderate" ? "bg-info/15 text-info" :
    level === "Elevated" ? "bg-warning/15 text-warning" :
    "bg-destructive/15 text-destructive";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{level}</span>;
}
function EligPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const tone =
    status === "Approved" ? "bg-success/15 text-success" :
    status === "Conditional Approval" ? "bg-info/15 text-info" :
    status === "Manual Review" ? "bg-warning/15 text-warning" :
    "bg-destructive/15 text-destructive";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}
