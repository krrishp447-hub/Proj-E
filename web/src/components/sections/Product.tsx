import Link from "next/link";
import { DEFAULT_QUERY, ScoutApp } from "@/components/demo/ScoutApp";

/** The live product, embedded on the homepage: same component as /demo, minus its top bar. */
export function Product() {
  return (
    <section id="product" className="sec product" data-io>
      <div className="edge">
        <div className="product-head">
          <div>
            <div className="mono mb-[18px]">04 — THE PRODUCT · LIVE</div>
            <h2 className="disp big rev">Try it.<br />Right here.</h2>
          </div>
          <Link className="pbtn ghost" href="/demo">Open full screen ↗</Link>
        </div>
        <div className="appframe rev" style={{ "--d": ".1s" } as React.CSSProperties}>
          <ScoutApp initialQuery={DEFAULT_QUERY} embedded />
        </div>
      </div>
    </section>
  );
}
