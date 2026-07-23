import type { RunResult } from "../dag/types";

export function renderTimeline(container: HTMLElement, result: RunResult | null): void {
  container.innerHTML = "";
  if (!result || result.entries.length === 0) return;

  const totalMs = Math.max(result.totalMs, 1);
  const laneCount = Math.max(...result.entries.map((e) => e.lane)) + 1;

  for (let lane = 0; lane < laneCount; lane++) {
    const laneEl = document.createElement("div");
    laneEl.className = "tl-lane";
    for (const entry of result.entries.filter((e) => e.lane === lane)) {
      const bar = document.createElement("div");
      bar.className = "tl-bar";
      const leftPct = (entry.start / totalMs) * 100;
      const widthPct = Math.max(((entry.end - entry.start) / totalMs) * 100, 1);
      bar.style.left = `${leftPct}%`;
      bar.style.width = `${widthPct}%`;
      bar.textContent = entry.label;
      bar.title = `${entry.label}: ${Math.round(entry.start)}–${Math.round(entry.end)}ms`;
      laneEl.appendChild(bar);
    }
    container.appendChild(laneEl);
  }
}

export function renderSummary(container: HTMLElement, beads: RunResult | null, actors: RunResult | null): void {
  if (!beads && !actors) {
    container.textContent = "";
    return;
  }
  const parts: string[] = [];
  if (beads) parts.push(`Beads total: <strong>${Math.round(beads.totalMs)}ms</strong>`);
  if (actors) parts.push(`Actors total: <strong>${Math.round(actors.totalMs)}ms</strong>`);
  if (beads && actors) {
    const ratio = beads.totalMs / Math.max(actors.totalMs, 1);
    parts.push(`Actors were <strong>${ratio.toFixed(2)}&times;</strong> the speed of Beads on this run`);
  }
  container.innerHTML = parts.join(" &nbsp;|&nbsp; ");
}
