import Link from "next/link";
import { HomeTry } from "@/components/sections/HomeTry";
import { DEFAULT_QUERY, HOME_RESULTS, searchAll } from "@/lib/scout/search";
import { getCreators } from "@/server/creators";

/**
 * A taste of the product on the homepage: one brief over every creator, the best few matches, then pricing or the full
 * app. The app itself (shortlist, compare, campaigns, share of voice) lives at /discover.
 */
export async function Product() {
  const { creators } = await getCreators();
  const r = searchAll(creators, DEFAULT_QUERY, { limit: HOME_RESULTS, missLimit: 0 });
  return (
    <section id="product" className="sec product" data-io>
      <div className="edge">
        <div className="product-head">
          <div>
            <div className="mono mb-[18px]">04 — THE PRODUCT · LIVE</div>
            <h2 className="disp big rev">Try it.<br />Right here.</h2>
          </div>
          <Link className="pbtn ghost" href="/pricing">Plans &amp; free trial ↗</Link>
        </div>
        <div className="appframe rev" style={{ "--d": ".1s" } as React.CSSProperties}>
          <HomeTry initial={{ query: r.query, understood: r.understood, fitCount: r.fitCount, total: r.total, fits: r.fits }} />
        </div>
      </div>
    </section>
  );
}
