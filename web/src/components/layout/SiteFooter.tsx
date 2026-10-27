import Link from "next/link";
import { site } from "@/config/site";
import { Logo } from "@/components/ui/Logo";

const navigate = [
  { href: "#manifesto", label: "Platform" },
  { href: "#feature", label: "Niches" },
  { href: "#listing", label: "Results" },
  { href: "/pricing", label: "Pricing" },
];

const maybeLink = (l: { href?: string; label: string }) => (l.href ? <a href={l.href}>{l.label}</a> : <span>{l.label}</span>);

export function SiteFooter() {
  return (
    <footer id="footer" className="site-footer">
      <div className="fgrid">
        <div>
          <div className="wm"><Logo /></div>
          <p className="desc mt-4 max-w-[24ch] text-earth!">THE CREATOR INTELLIGENCE LAYER FOR BRANDS &amp; AGENCIES.</p>
        </div>
        <div>
          <h2 className="fhead">Navigate</h2>
          <ul>{navigate.map((l) => <li key={l.label}>{maybeLink(l)}</li>)}</ul>
        </div>
        <div>
          <h2 className="fhead">Social</h2>
          <ul>{site.social.map((s) => <li key={s.label}>{maybeLink({ href: s.href, label: s.footerLabel ?? s.label })}</li>)}</ul>
        </div>
        <div>
          <h2 className="fhead">Contact</h2>
          <ul>
            <li><a href={`mailto:${site.email}`}>{site.email}</a></li>
            <li className="mono normal-case opacity-80">{site.address}</li>
            <li className="mono opacity-80">{site.coords}</li>
          </ul>
        </div>
      </div>
      <div className="legal"><span>© 2026 SCOUTBLACK — ALL RIGHTS RESERVED</span><span><Link href="/privacy">PRIVACY</Link> · <Link href="/terms">TERMS</Link></span></div>
    </footer>
  );
}
