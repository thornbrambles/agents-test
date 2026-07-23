import type { Dag, RunResult, TimelineEntry } from "../dag/types";
import { materializeSpawn } from "../dag/spawn";
import { Semaphore, sleep } from "./util";

export interface BeadsOptions {
  /** How many workers pull from the shared "ready" queue at once. Beads itself
   * is just a dependency tracker — this models a small team (or a single
   * agent) polling `bd ready` and claiming issues one at a time. */
  workers: number;
  /** Divide durations by this to speed up/slow down the simulated run. */
  speed: number;
  /** Seeds any dynamic-spawn decisions, so beads and actors see the same ones. */
  seed: number;
  /** Caps how many "agent" kind nodes may run at once, across all workers —
   * a stand-in for a shared LLM API rate limit. Undefined = unlimited. */
  agentConcurrency?: number;
}

/**
 * Simulates working a Beads-style issue graph: a shared FIFO "ready" queue
 * that a fixed pool of workers pull from. A node only enters the queue once
 * every dependency is marked done — the same "blocked -> ready -> done"
 * lifecycle Beads tracks for real issues. Nodes with a `spawns` rule can add
 * new nodes to the graph the instant they finish.
 */
export async function runBeads(dag: Dag, options: BeadsOptions): Promise<RunResult> {
  const { workers, speed, seed, agentConcurrency } = options;
  const agentSem = agentConcurrency ? new Semaphore(agentConcurrency) : null;
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const remainingDeps = new Map(dag.nodes.map((n) => [n.id, n.dependsOn.length]));
  const dependents = new Map<string, string[]>(dag.nodes.map((n) => [n.id, []]));
  for (const node of dag.nodes) {
    for (const dep of node.dependsOn) {
      dependents.get(dep)?.push(node.id);
    }
  }

  const doneIds = new Set<string>();
  const ready: string[] = dag.nodes.filter((n) => n.dependsOn.length === 0).map((n) => n.id);
  const entries: TimelineEntry[] = [];
  const start = performance.now();
  let remaining = dag.nodes.length;
  let waiters: Array<() => void> = [];

  function waitForWork(): Promise<void> {
    return new Promise((resolve) => {
      waiters.push(resolve);
    });
  }

  function wake(): void {
    const pending = waiters;
    waiters = [];
    for (const fn of pending) fn();
  }

  function addNode(node: { id: string; dependsOn: string[] }): void {
    dependents.set(node.id, []);
    const unresolved = node.dependsOn.filter((d) => !doneIds.has(d));
    remainingDeps.set(node.id, unresolved.length);
    for (const dep of unresolved) dependents.get(dep)?.push(node.id);
    remaining++;
    if (unresolved.length === 0) ready.push(node.id);
  }

  async function worker(lane: number): Promise<void> {
    while (remaining > 0) {
      const nodeId = ready.shift();
      if (!nodeId) {
        if (remaining === 0) return;
        await waitForWork();
        continue;
      }
      const node = byId.get(nodeId)!;
      const kind = node.kind ?? "job";
      const releaseAgent = kind === "agent" && agentSem ? await agentSem.acquire() : null;
      const nodeStart = performance.now() - start;
      await sleep(node.durationMs / speed);
      const nodeEnd = performance.now() - start;
      releaseAgent?.();
      entries.push({ nodeId, label: node.label, start: nodeStart, end: nodeEnd, lane, kind });
      doneIds.add(nodeId);

      if (node.spawns) {
        for (const spawned of materializeSpawn(seed, nodeId, node.spawns, byId)) {
          addNode(spawned);
        }
      }

      for (const depId of dependents.get(nodeId) ?? []) {
        const left = (remainingDeps.get(depId) ?? 0) - 1;
        remainingDeps.set(depId, left);
        if (left === 0) ready.push(depId);
      }
      remaining--;
      wake();
    }
  }

  await Promise.all(Array.from({ length: workers }, (_, lane) => worker(lane)));

  return { strategy: "beads", entries, totalMs: performance.now() - start };
}
