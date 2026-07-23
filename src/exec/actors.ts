import type { Dag, RunResult, TimelineEntry } from "../dag/types";
import { Semaphore, sleep } from "./util";

export interface ActorsOptions {
  /** Optional cap so the comparison can be apples-to-apples with a beads
   * worker pool. Leave undefined for unlimited concurrency (the "pure"
   * actor-model behavior: every node with satisfied deps starts instantly). */
  maxConcurrency?: number;
  speed: number;
}

/**
 * Simulates an actor-model run: every node is its own actor that reacts the
 * instant its dependency actors' "done" messages have all arrived, then
 * broadcasts its own "done" to dependents. There is no shared queue or
 * central scheduler — parallelism falls out of the message graph itself.
 */
export async function runActors(dag: Dag, options: ActorsOptions): Promise<RunResult> {
  const { maxConcurrency, speed } = options;
  const sem = maxConcurrency ? new Semaphore(maxConcurrency) : null;
  const byId = new Map(dag.nodes.map((n) => [n.id, n]));
  const entries: TimelineEntry[] = [];
  const start = performance.now();
  let nextLane = 0;
  const freeLanes: number[] = [];

  function claimLane(): number {
    return freeLanes.pop() ?? nextLane++;
  }

  const done = new Map<string, Promise<void>>();

  function actorFor(id: string): Promise<void> {
    const cached = done.get(id);
    if (cached) return cached;

    const node = byId.get(id)!;
    const promise = (async () => {
      await Promise.all(node.dependsOn.map((dep) => actorFor(dep)));
      const release = sem ? await sem.acquire() : null;
      const lane = claimLane();
      const nodeStart = performance.now() - start;
      await sleep(node.durationMs / speed);
      const nodeEnd = performance.now() - start;
      entries.push({ nodeId: id, label: node.label, start: nodeStart, end: nodeEnd, lane });
      freeLanes.push(lane);
      release?.();
    })();

    done.set(id, promise);
    return promise;
  }

  await Promise.all(dag.nodes.map((n) => actorFor(n.id)));

  return { strategy: "actors", entries, totalMs: performance.now() - start };
}
