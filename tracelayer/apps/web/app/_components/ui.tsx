import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Label, Tone } from '../_lib/proof-labels.js';
import { shortMiddle } from '../_lib/format.js';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/demo', label: 'Demo' },
  { href: '/runs', label: 'Runs' },
  { href: '/proofs', label: 'Proofs' },
  { href: '/replay/run_phase_2_5_test', label: 'Replay' },
  { href: '/delegates', label: 'Delegates' },
];

export const brandLogoSrc = '/favicon.ico';
export const brandLogoAlt = 'TraceLayer logo';
export const brandWordmark = 'TraceLayer';
export const brandSubtitle = 'Proof Control Plane';

export function Brand({ href = '/dashboard' }: { href?: string }) {
  return (
    <a className="brand" href={href}>
      <span className="logo" aria-hidden="true">
        <img src={brandLogoSrc} alt={brandLogoAlt} width={32} height={32} />
      </span>
      <span className="brand-copy">
        <b>{brandWordmark}</b>
        <span>{brandSubtitle}</span>
      </span>
    </a>
  );
}

export function ProductShell({ active, children, selectedRunId }: { active: string; children: ReactNode; selectedRunId?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="nav-label">Workspace</div>
        <nav className="side-nav" aria-label="Workspace">
          {navItems.map((item) => (
            <a key={item.href} className={item.label === active ? 'active' : undefined} href={item.href}>
              <span className="dot" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="nav-label">Control</div>
        <nav className="side-nav" aria-label="Control">
          <a className={active === 'Artifacts' ? 'active' : undefined} href="/artifacts/artifact_run_phase_2_5_test">
            <span className="dot" aria-hidden="true" />
            <span>Artifacts</span>
          </a>
          <a className={active === 'Settings' ? 'active' : undefined} href="/settings/model">
            <span className="dot" aria-hidden="true" />
            <span>Model settings</span>
          </a>
          <a href="/dev/anchor-smoke">
            <span className="dot" aria-hidden="true" />
            <span>Dev smoke</span>
          </a>
        </nav>
        <div className="sidebar-card">
          <div className="small">Latest proof run</div>
          <StatusPill label={{ tone: 'green', text: 'Recorded · verified' }} />
          <div className="small" style={{ marginTop: 10 }}>Run ID</div>
          <div className="mono trunc">{selectedRunId ?? 'run_phase_2_5_test'}</div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function Topbar({ current, badges }: { current: string; badges?: Label[] }) {
  return (
    <header className="topbar">
      <div className="crumbs">
        <span>{current}</span>
        <span>/</span>
        <span className="mono trunc">proof control plane</span>
      </div>
      {badges ? (
        <div className="cluster">
          {badges.map((badge) => (
            <StatusPill key={`${badge.tone}-${badge.text}`} label={badge} />
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function StatusPill({ label }: { label: Label }) {
  return (
    <span className={`pill tone-${label.tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {label.text}
    </span>
  );
}

export function ButtonLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a className={`btn${primary ? ' primary' : ''}`} href={href}>
      {children}
    </a>
  );
}

export function Button({ children, primary = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button className={`btn${primary ? ' primary' : ''}`} type="button" {...props}>
      {children}
    </button>
  );
}

export function HeroPanel({ kicker, title, children, actions, badges }: { kicker: string; title: ReactNode; children: ReactNode; actions?: ReactNode; badges?: Label[] }) {
  return (
    <section className="hero-panel">
      <div className="hero-top">
        <div>
          <div className="kicker">{kicker}</div>
          <h1 className="page-title">{title}</h1>
          <p className="sub">{children}</p>
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      {badges ? (
        <div className="badges" style={{ marginTop: 16 }}>
          {badges.map((badge) => (
            <StatusPill key={`${badge.tone}-${badge.text}`} label={badge} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function Card({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <article className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </article>
  );
}

export function DataField({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={mono ? 'mono' : undefined}>{value}</div>
    </div>
  );
}

export function KeyValue({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="kv">
      <label>{label}</label>
      <div className={`val${mono ? ' mono' : ''}`}>{value}</div>
    </div>
  );
}

export function ProofPathRibbon({ steps }: { steps: readonly { title: string; subtitle: string; tone: Tone }[] }) {
  return (
    <div className="proof-path">
      <div className="proof-steps">
        {steps.map((step) => (
          <div key={`${step.title}-${step.subtitle}`} className={`proof-step tone-${step.tone}`}>
            <b>{step.title}</b>
            <span>{step.subtitle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProofTimeline({ events }: { events: readonly { title: string; description: string; tone: Tone; reference?: string }[] }) {
  return (
    <div className="timeline">
      {events.map((event) => (
        <article key={`${event.title}-${event.reference ?? event.description}`} className={`receipt tone-${event.tone}`}>
          <div className="receipt-head">
            <div>
              <h3>{event.title}</h3>
              <p>{event.description}</p>
            </div>
            <StatusPill label={{ tone: event.tone, text: event.title }} />
          </div>
          {event.reference ? <div className="helper mono">{event.reference}</div> : null}
        </article>
      ))}
    </div>
  );
}

export function HashComparison({ expected, readback, label }: { expected: string; readback: string; label: Label }) {
  return (
    <div className="hash-compare">
      <div className="hash-top">
        <div className="hash-title">SHA-256 readback verification</div>
        <StatusPill label={label} />
      </div>
      <div className="hash-grid">
        <div className="value-box">
          <label>Expected artifact hash</label>
          <div className="mono">{expected}</div>
        </div>
        <div className="equals">=</div>
        <div className="value-box">
          <label>Readback hash</label>
          <div className="mono">{readback}</div>
        </div>
      </div>
    </div>
  );
}

export function Identifier({ value, head = 12, tail = 8 }: { value: string | undefined; head?: number; tail?: number }) {
  return <span title={value} className="mono">{shortMiddle(value, head, tail)}</span>;
}
