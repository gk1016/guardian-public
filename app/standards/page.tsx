import { PublicShell } from "@/components/public-shell";

const standards = [
  {
    title: "Positive Control",
    body: "Package geometry, role ownership, and dispatch changes should be explicit. If command has to guess, command is already behind.",
  },
  {
    title: "Rescue Discipline",
    body: "Distress traffic is not trusted blindly. Rescue launches are reviewed against the current threat picture before assets are committed.",
  },
  {
    title: "After-Action Honesty",
    body: "Guardian is meant to keep lessons learned attached to the event that produced them, not buried in chat or memory.",
  },
];

export default function StandardsPage() {
  return (
    <PublicShell
      eyebrow="Standards"
      title="The point is not looking tactical. The point is being disciplined."
      description="Guardian bakes standards into the workflow so doctrine and review survive contact with actual operations."
    >
      <section className="grid gap-6 md:grid-cols-3">
        {standards.map((standard) => (
          <article key={standard.title} className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
            <h2 className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-white">
              {standard.title}
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-300">{standard.body}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
