"use client";

import { site } from "@/config/site";
import { useAnimatedDialog } from "@/hooks/useAnimatedDialog";

const sectionLinks = [
  { href: "#manifesto", label: "Platform" },
  { href: "#feature", label: "Niches" },
  { href: "#listing", label: "Results" },
  { href: "#product", label: "Product" },
];

export function SiteNav() {
  const { ref: menuRef, shown: menuShown, open: openMenu, close: closeMenu, onCancel: onMenuCancel } = useAnimatedDialog(600);

  return (
    <>
      <nav className="topnav" aria-label="Primary">
        <div className="l">
          {sectionLinks.map((l) => (
            <a key={l.href} href={l.href}>{l.label.toUpperCase()}</a>
          ))}
        </div>
        <div className="wm">SCOUT</div>
        <div className="r">
          <a href="/pricing">PRICING</a>
          <a href="/login">LOG IN</a>
          <a href="#footer">CONTACT</a>
          <button className="menu" type="button" aria-haspopup="dialog" aria-label="Open menu" onClick={openMenu}>
            •••
          </button>
        </div>
      </nav>

      <dialog
        ref={menuRef}
        className={`overlay navmenu ${menuShown ? "show" : ""}`}
        aria-label="Menu"
        onCancel={onMenuCancel}
      >
        <button className="x" type="button" onClick={closeMenu}>CLOSE ✕</button>
        <div className="idx">MENU · SCOUT / 25</div>
        <nav className="links" aria-label="Menu">
          {sectionLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={closeMenu}>{l.label}</a>
          ))}
          <a href={site.demoHref}>Live demo ↗</a>
          <a href="/pricing">Pricing</a>
          <a href="/login">Log in</a>
          <a href="#footer" onClick={closeMenu}>Contact</a>
        </nav>
        <div className="mfoot">
          <span>{site.email}</span>
          <div className="flex gap-[22px]">
            {site.social.map((s) => (s.href ? <a key={s.label} href={s.href}>{s.label}</a> : <span key={s.label}>{s.label}</span>))}
          </div>
          <span>{site.coords}</span>
        </div>
      </dialog>
    </>
  );
}
