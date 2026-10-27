import Link from "next/link";
import "@/components/account/account.css";

export default function NotFound() {
  return (
    <main className="acct">
      <Link href="/" className="acct-back">← ScoutBlack</Link>
      <h1 className="disp big">Not found</h1>
      <p className="acct-lede">That page doesn&apos;t exist, or it moved.</p>
      <div className="acct-actions">
        <Link className="acct-btn on-ink" href="/">Home</Link>
        <Link className="acct-btn" href="/pricing">Pricing</Link>
      </div>
    </main>
  );
}
