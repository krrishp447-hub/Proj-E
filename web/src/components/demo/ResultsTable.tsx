import { authTone } from "@/lib/scout/data";
import { youtubeUrl } from "@/lib/scout/contact";
import { fmt, type Match } from "@/lib/scout/engine";

export type SortKey = "score" | "subs" | "eng" | "growth" | "auth";

const COLS: { key: SortKey; label: string }[] = [
  { key: "subs", label: "Subs" },
  { key: "eng", label: "Eng." },
  { key: "growth", label: "Growth" },
  { key: "auth", label: "Auth." },
  { key: "score", label: "Match" },
];

type Props = {
  rows: Match[];
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  activeId?: string; // channel id
  onSelect: (id: string) => void;
  shortlist: string[];
  onToggle: (id: string) => void;
};

export function ResultsTable({ rows, sort, onSort, activeId, onSelect, shortlist, onToggle }: Props) {
  return (
    <table className="d-table">
      <thead>
        <tr>
          <th scope="col" className="d-c-check"><span className="sr-only">Shortlist</span></th>
          <th scope="col" className="d-c-rank">#</th>
          <th scope="col">Creator</th>
          <th scope="col" className="d-c-plat">Platform</th>
          {COLS.map((c) => (
            <th key={c.key} scope="col" className={`d-num ${c.key === "score" ? "d-c-match" : c.key === "subs" ? "" : "d-c-opt"}`} aria-sort={sort.key === c.key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
              <button type="button" onClick={() => onSort(c.key)}>
                {c.label}
                <span aria-hidden="true" className="d-sort">{sort.key === c.key ? (sort.dir === -1 ? "↓" : "↑") : ""}</span>
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((m, i) => {
          const c = m.creator;
          const on = shortlist.includes(c.channelId);
          return (
            <tr key={c.channelId} className={`${c.channelId === activeId ? "is-active" : ""} ${m.fits ? "" : "is-miss"}`} onClick={() => onSelect(c.channelId)}>
              <td className="d-c-check" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={on} onChange={() => onToggle(c.channelId)} aria-label={`Shortlist ${c.name}`} />
              </td>
              <td className="d-c-rank d-mono">{String(i + 1).padStart(2, "0")}</td>
              <td>
                <button type="button" className="d-name" onClick={(e) => { e.stopPropagation(); onSelect(c.channelId); }}>
                  {c.name}
                  {c.proven && <span className="d-proven" title="Proven on-platform record">◆</span>}
                </button>
                <div className="d-sub">{c.niche} · {c.country}</div>
              </td>
              <td className="d-c-plat" onClick={(e) => e.stopPropagation()}>
                <a className="d-yt" href={youtubeUrl(c.channelId)} target="_blank" rel="noopener noreferrer" aria-label={`View ${c.name} on YouTube (new tab)`}>YT ↗</a>
              </td>
              <td className="d-num d-mono">{fmt(c.subs)}</td>
              <td className="d-num d-mono d-c-opt">{c.eng}%</td>
              <td className="d-num d-mono d-c-opt">+{c.growth}%</td>
              <td className={`d-num d-mono d-c-opt ${authTone(c.auth)}`}>{c.auth}</td>
              <td className="d-num d-c-match">
                <span className="d-meter" aria-hidden="true"><i style={{ width: `${m.score}%` }} /></span>
                <b className="d-mono">{m.score}</b>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
