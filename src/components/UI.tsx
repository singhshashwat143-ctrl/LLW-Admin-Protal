import type { ReactNode } from "react";
import { formatCurrency } from "../lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="glass-card rounded-2xl px-6 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-strong)] sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3 mt-4 lg:mt-0">{actions}</div> : null}
      </div>
    </section>
  );
}

export function StatCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</p>
      <h3 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-strong)]">{value}</h3>
      <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">{meta}</p>
    </div>
  );
}

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 lg:p-6">
      <div className="mb-5 flex flex-col gap-1">
        <h3 className="text-lg font-bold tracking-tight text-[var(--text-strong)]">{title}</h3>
        {subtitle ? <p className="text-[13px] text-[var(--text-secondary)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "blue" | "green" | "purple" | "teal" | "red" }) {
  const tones = {
    gold: "badge badge-gold",
    blue: "badge badge-blue",
    green: "badge badge-green",
    purple: "badge badge-purple",
    teal: "badge badge-teal",
    red: "badge badge-red",
  };

  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[var(--text-strong)]">{typeof value === "number" ? formatCurrency(value) : value}</p>
    </div>
  );
}
