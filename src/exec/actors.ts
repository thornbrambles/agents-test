import type { Dag, RunResult, TimelineEntry } from "../dag/types";
import { materializeSpawn } from "../dag/spawn";
import { Semaphore, sleep } from "./util";

export interface ActorsOptions {
  /** Optional cap so the comparison can be apples-to-apples with a beads
   * worker pool. Leave undefined for unlimited concurrency (the "pure"
   * actor-model behavior: every node with satisfied deps starts instantly). */
  maxConcurrency?: number;
  speed: number;
  /** Seeds any dynamic-spawn decisions, so beads and actors see the same ones. */
  seed: number;
  /** Caps how many "agent" kind nodes may run at once, across all actors —
   * a stand-in for a shared LLM API rate limit. Undefined = unlimited. */
  agentConcurrency?: number;
}

/**
 * Simulates an actor-model run: every node is its own actor that reacts the
 * instant its dependency actors' "done" messages have all arrived, then
 * broadcasts its own "done" to dependents. There is no shared queue or
 * central scheduler — parallelism falls out of the message graph itself.
 * Nodes with a `spawns` rule create new actors on the fly as they finish.
 */
export async function runActors(dag: Dag, options: ActorsOptions): Promise<RunResult> {
  const { maxConcurrency, speed, seed, agentConcurrency } = options;
  const sem = maxConcurrency ? new Semaphore(maxConcurrency) : null;
  const agentSem = agentConcurrency ? new Semaphore(agentConcurrency) : null;
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const entries: TimelineEntry[] = [];
  const start = performance.now();
  let nextLane = 0;
  const freeLanes: number[] = [];

  function claimLane(): number {
    return freeLanes.pop() ?? nextLane++;
  }

  const done = new Map<string, Promise<void>>();
  const allActors = new Set<Promise<void>>();

  function actorFor(id: string): Promise<void> {
    const cached = done.get(id);
    if (cached) return cached;

    const node = byId.get(id)!;
    const kind = node.kind ?? "job";
    const promise = (async () => {
      await Promise.all(node.dependsOn.map((dep) => actorFor(dep)));
      const release = sem ? await sem.acquire() : null;
      const releaseAgent = kind === "agent" && agentSem ? await agentSem.acquire() : null;
      const lane = claimLane();
      const nodeStart = performance.now() - start;
      await sleep(node.durationMs / speed);
      const nodeEnd = performance.now() - start;
      entries.push({ nodeId: id, label: node.label, start: nodeStart, end: nodeEnd, lane, kind });
      freeLanes.push(lane);
      releaseAgent?.();
      release?.();

      if (node.spawns) {
        for (const spawned of materializeSpawn(seed, id, node.spawns, byId)) {
          allActors.add(actorFor(spawned.id));
        }
      }
    })();

    done.set(id, promise);
    allActors.add(promise);
    return promise;
  }

  for (const n of dag.nodes) actorFor(n.id);

  // Spawning happens synchronously inside an actor's own async body before it
  // settles, so each wave of Promise.all already picks up that wave's spawns.
  // Loop until a full wave produces no new actors.
  for (;;) {
    const wave = Array.from(allActors);
    await Promise.all(wave);
    if (allActors.size === wave.length) break;
  }

  return { strategy: "actors", entries, totalMs: performance.now() - start };
}
