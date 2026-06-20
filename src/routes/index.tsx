import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Sparkles, BarChart3, Users, Layers, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Credit Vision — Credit for the credit-invisible" },
      { name: "description", content: "Alternative credit assessment built for students, freelancers, gig workers and first-time borrowers. Missing history isn't risk." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-brand)] btn-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Credit Vision</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="sm" className="bg-[image:var(--gradient-brand)] text-primary-foreground btn-glow hover:opacity-90">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        {/* Hero */}
        <section className="relative pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="pointer-events-none absolute inset-0 -z-10 [background:var(--gradient-glow)]" />
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Alternative credit assessment platform
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] md:text-7xl">
              Credit scoring that <span className="text-gradient">sees you</span>, not your file thickness.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              For students, freelancers, gig workers and first-time borrowers. We score on income discipline,
              banking behaviour, employment quality and skill — not whether you ever held a credit card.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="lg" className="bg-[image:var(--gradient-brand)] text-primary-foreground btn-glow hover:opacity-90">
                  Start an assessment <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
            </div>
            <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
              No credit history = missing information, <span className="text-foreground">not risk</span>
            </p>
          </div>
        </section>

        {/* Feature grid */}
        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Risk ≠ Confidence", body: "We report risk and confidence separately. Missing data lowers confidence, not your score." },
            { icon: BarChart3, title: "Six-factor model", body: "Financial stability, banking, employment, behaviour, education and bills — each independently weighted." },
            { icon: Users, title: "Built for the invisible", body: "Students, freshers, gig workers and self-employed get evaluated on what they actually have." },
            { icon: Layers, title: "Capacity-based lending", body: "Loan amounts and rates derived from your real surplus — never hard-coded." },
            { icon: Zap, title: "Instant insight", body: "A complete assessment, radar breakdown and lending plan in under three minutes." },
            { icon: Sparkles, title: "Transparent reasoning", body: "Every score comes with the inputs, weights, strengths and concerns that drove it." },
          ].map((f) => (
            <div key={f.title} className="card-elevated p-6">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Credit Vision</span>
          <span>Built for credit-invisible consumers</span>
        </div>
      </footer>
    </div>
  );
}
