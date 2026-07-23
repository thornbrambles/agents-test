import "./style.css";
import type { RunResult } from "./dag/types";
import { runBeads } from "./exec/beads";
import { runActors } from "./exec/actors";
import { initDagEditor } from "./ui/dagEditor";
import { renderSummary, renderTimeline } from "./ui/timelineView";
import { initAuthPanel } from "./ui/authPanel";

initAuthPanel();
const { getDag } = initDagEditor();

const workersInput = document.getElementById("workers-input") as HTMLInputElement;
const capActorsInput = document.getElementById("cap-actors-input") as HTMLInputElement;
const speedInput = document.getElementById("speed-input") as HTMLInputElement;
const speedLabel = document.getElementById("speed-label")!;
const seedInput = document.getElementById("seed-input") as HTMLInputElement;
const rerollSeedBtn = document.getElementById("reroll-seed-btn") as HTMLButtonElement;
const runBeadsBtn = document.getElementById("run-beads-btn") as HTMLButtonElement;
const runActorsBtn = document.getElementById("run-actors-btn") as HTMLButtonElement;
const runBothBtn = document.getElementById("run-both-btn") as HTMLButtonElement;
const summaryEl = document.getElementById("summary")!;
const beadsTimelineEl = document.getElementById("beads-timeline")!;
const actorsTimelineEl = document.getElementById("actors-timeline")!;

let lastBeads: RunResult | null = null;
let lastActors: RunResult | null = null;
const allButtons = [runBeadsBtn, runActorsBtn, runBothBtn];

speedInput.addEventListener("input", () => {
  speedLabel.textContent = `${speedInput.value}×`;
});

rerollSeedBtn.addEventListener("click", () => {
  seedInput.value = String(Math.floor(Math.random() * 1_000_000));
});

function setRunning(running: boolean): void {
  for (const btn of allButtons) btn.disabled = running;
}

async function doRunBeads(): Promise<void> {
  const dag = getDag();
  if (!dag) return;
  const workers = Math.max(1, Number(workersInput.value) || 1);
  const speed = Number(speedInput.value) || 1;
  const seed = Number(seedInput.value) || 0;
  lastBeads = await runBeads(dag, { workers, speed, seed });
  renderTimeline(beadsTimelineEl, lastBeads);
  renderSummary(summaryEl, lastBeads, lastActors);
}

async function doRunActors(): Promise<void> {
  const dag = getDag();
  if (!dag) return;
  const workers = Math.max(1, Number(workersInput.value) || 1);
  const speed = Number(speedInput.value) || 1;
  const seed = Number(seedInput.value) || 0;
  lastActors = await runActors(dag, {
    speed,
    seed,
    maxConcurrency: capActorsInput.checked ? workers : undefined,
  });
  renderTimeline(actorsTimelineEl, lastActors);
  renderSummary(summaryEl, lastBeads, lastActors);
}

runBeadsBtn.addEventListener("click", async () => {
  setRunning(true);
  await doRunBeads();
  setRunning(false);
});

runActorsBtn.addEventListener("click", async () => {
  setRunning(true);
  await doRunActors();
  setRunning(false);
});

runBothBtn.addEventListener("click", async () => {
  setRunning(true);
  await Promise.all([doRunBeads(), doRunActors()]);
  setRunning(false);
});
