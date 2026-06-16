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
  head: () => ({ meta: [{ title: "Reports — CreditVision AI" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: ReportsList,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function ReportsList() {
  const { data: rows } = useSuspenseQuery(opts);
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">All your CreditVision assessments.</p>

      <div className="mt-6 card-elevated overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No reports yet.</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
