import { Check } from "lucide-react";

// A change moving through its approval route, as on a real request. Decorative only.
const STAGES = [
  { label: "Raised", who: "Claims Officer" },
  { label: "Line Manager", who: "Approved" },
  { label: "Change Advisory Board", who: "Approved" },
  { label: "Scheduled", who: "Sat 20:00–23:00" },
];

/** The stages tick in one after another when the page loads (CSS only, skipped with reduced motion). */
export default function RouteIllustration() {
  return (
    <div aria-hidden className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs text-white/50">CHG-2026-0152</span>
        <span className="route-badge rounded-full bg-[#5fd6d8]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#5fd6d8]">Scheduled</span>
      </div>
      <ol className="relative">
        {STAGES.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0" style={{ ["--i" as string]: i }}>
            {i < STAGES.length - 1 && <span className="route-line absolute top-6 bottom-0 left-[11px] w-px bg-[#5fd6d8]/60" />}
            <span className="route-dot relative grid size-6 shrink-0 place-items-center rounded-full bg-[#17b3b5] text-[#0d1322]">
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="route-text min-w-0">
              <span className="block text-sm font-bold text-white">{s.label}</span>
              <span className="block text-xs text-white/50">{s.who}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
