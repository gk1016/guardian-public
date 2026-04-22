import { PublicShell } from "@/components/public-shell";

const sections = [
  {
    title: "Why Guardian Exists",
    body: "Guardian exists because serious anti-piracy and rescue work falls apart when planning, dispatch, and review are scattered across chat, screenshots, and memory.",
  },
  {
    title: "What It Is",
    body: "This is a standalone operations platform for a military-pilot Star Citizen org. It supports mission planning, QRF posture, CSAR workflow, threat tracking, and review discipline.",
  },
  {
    title: "What It Is Not",
    body: "It is not a consumer dashboard, not a streamer overlay, and not a pile of feature demos. The product is being built around operators, packages, and command decisions.",
  },
];

export default function AboutPage() {
  return (
    <PublicShell
      eyebrow="Platform Overview"
      title="Built for operators who would rather fly than babysit bad tooling."
      description="Guardian keeps planning, dispatch, rescue, and review inside one system so command does not have to reconstruct the fight from scraps."
    >
      <section className="grid gap-6 lg:grid-cols-3">
        {sections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-[var(--color-border-bright)] bg-slate-950/60 p-6">
            <h2 className="font-[family:var(--font-display)] text-3xl uppercase tracking-[0.14em] text-[var(--color-text-strong)]">
              {section.title}
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-300">{section.body}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
