import Link from "next/link";
import type { ReactNode } from "react";

/** Plain, readable shell for policy pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legalpage">
      <Link href="/" className="legal-back mono">← Scout</Link>
      <h1 className="disp big">{title}</h1>
      <p className="mono legal-meta">Last updated {updated} · Draft — review with legal counsel before launch</p>
      <div className="legal-body">{children}</div>
    </main>
  );
}
