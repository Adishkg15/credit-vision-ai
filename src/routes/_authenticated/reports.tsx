import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string; created_at: string; overall_score: number | null;
  confidence_score: number | null; risk_level: string | null;
  eligibility_status: string | null; applicant_name: string | null;
};

const opts = queryOptions({
  queryKey: ["assessments", "all"],
  queryFn: async (): Promise<Row[]> => {
    const { data, error } = await supabase
      .from("assessments")
      .select("id, created_at, overall_score, confidence_score, risk_level, eligibility_status, applicant_name")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Credit Vision" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: ReportsList,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function ReportsList() {
  const { data: rows } = useSuspenseQuery(opts);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">All your Credit Vision assessments.</p>

      {rows.length === 0 ? (
        <div className="mt-6 card-elevated p-10 text-center text-sm text-muted-foreground">No reports yet.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="mt-6 flex flex-col gap-3 md:hidden">
            {rows.map(r => (
              <Link
                key={r.id}
                to="/report/$id"
                params={{ id: r.id }}
                className="card-elevated p-4 transition hover:bg-surface/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.applicant_name || "Unnamed applicant"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-xl font-semibold">{r.overall_score ?? "—"}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Risk: <span className="text-foreground">{r.risk_level ?? "—"}</span></span>
                  <span>Eligibility: <span className="text-foreground">{r.eligibility_status ?? "—"}</span></span>
                  <span>Conf {r.confidence_score ?? "—"}%</span>
                  <span className="ml-auto font-medium text-primary">Open →</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="mt-6 hidden card-elevated overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Risk</th>
                  <th className="px-5 py-3">Eligibility</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface/50">
                    <td className="px-5 py-3">{r.applicant_name || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3 font-semibold">{r.overall_score ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.confidence_score ?? "—"}%</td>
                    <td className="px-5 py-3">{r.risk_level ?? "—"}</td>
                    <td className="px-5 py-3">{r.eligibility_status ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to="/report/$id" params={{ id: r.id }} className="text-primary hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
