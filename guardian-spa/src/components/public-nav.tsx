import { useState } from "react";
import { Link } from "react-router";
import { Menu, X } from "lucide-react";

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const navItems = [
  { href: "/about", label: "About" },
  { href: "/standards", label: "Standards" },
  { href: "/recruit", label: "Recruit" },
];

type PublicNavProps = {
  variant?: "landing" | "subpage";
};

export function PublicNav({ variant = "subpage" }: PublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = variant === "landing";

  return (
    <header
      className={`relative flex items-center justify-between border-b pb-4 ${
        isLanding ? "border-[var(--color-border)]" : "border-[var(--color-border-bright)] pb-6"
      }`}
    >
      <div>
        <Link
          to="/"
          className={`font-[family:var(--font-display)] uppercase text-[var(--color-accent)] ${
            isLanding
              ? "text-xl tracking-[0.24em]"
              : "text-2xl tracking-[0.32em]"
          }`}
        >
          Guardian
        </Link>
        <p
          className={`mt-0.5 uppercase text-[var(--color-text-secondary)] ${
            isLanding
              ? "text-[11px] tracking-[0.16em] text-[var(--color-text-tertiary)]"
              : "mt-1 text-sm tracking-[0.24em]"
          }`}
        >
          Operational Platform
        </p>
      </div>

      {/* Desktop nav */}
      <nav
        className={`hidden gap-5 uppercase text-[var(--color-text-secondary)] md:flex ${
          isLanding
            ? "text-xs tracking-[0.16em]"
            : "text-sm tracking-[0.2em]"
        }`}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="transition hover:text-[var(--color-text-strong)]"
          >
            {item.label}
          </Link>
        ))}
        <a
          href="https://github.com/gk1016/guardian-public"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition hover:text-[var(--color-text-strong)]"
        >
          <GithubIcon size={14} />
          GitHub
        </a>
        <Link to="/login" className="transition hover:text-[var(--color-text-strong)]">
          Sign In
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="rounded-[var(--radius-md)] border border-[var(--color-border-bright)] p-2 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)] md:hidden"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="absolute left-0 right-0 top-full z-50 border-b border-[var(--color-border-bright)] bg-[var(--color-bg)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm uppercase tracking-[0.16em] text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)]"
              >
                {item.label}
              </Link>
            ))}
            <a
              href="https://github.com/gk1016/guardian-public"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center gap-1.5 text-sm uppercase tracking-[0.16em] text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-strong)]"
            >
              <GithubIcon size={14} />
              GitHub
            </a>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-1 inline-flex w-fit items-center rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-amber-200"
            >
              Sign In
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
