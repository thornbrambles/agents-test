import type { DagNode, SpawnOutcome, SpawnRule } from "./types";

/** Deterministic pseudo-random unit float, keyed by seed + an arbitrary string.
 * Same (seed, key) always yields the same value, regardless of call order —
 * that's what lets beads and actors face identical dynamic-DAG decisions
 * even though they discover/execute nodes in different orders. */
export function hashToUnit(seed: number, key: string): number {
  let h = 0x811c9dc5 ^ seed;
  const s = `${seed}:${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

export function pickOutcome(seed: number, nodeId: string, outcomes: SpawnOutcome[]): SpawnOutcome {
  const totalWeight = outcomes.reduce((sum, o) => sum + (o.weight ?? 1), 0);
  const target = hashToUnit(seed, nodeId) * totalWeight;
  let acc = 0;
  for (const outcome of outcomes) {
    acc += outcome.weight ?? 1;
    if (target < acc) return outcome;
  }
  return outcomes[outcomes.length - 1];
}

/**
 * Resolves a completed node's spawn rule into concrete new DagNodes and
 * registers them in `byId`. Shared by both schedulers so a given (seed,
 * nodeId) always produces the exact same new nodes regardless of which
 * scheduler — or execution order — triggered it.
 */
export function materializeSpawn(
  seed: number,
  nodeId: string,
  rule: SpawnRule,
  byId: Map<string, DagNode>,
): DagNode[] {
  const outcome = pickOutcome(seed, nodeId, rule.outcomes);
  const created: DagNode[] = [];
  for (const tmpl of outcome.nodes) {
    if (byId.has(tmpl.id)) {
      console.warn(`Spawn skipped: node id "${tmpl.id}" already exists in the graph.`);
      continue;
    }
    const node: DagNode = {
      id: tmpl.id,
      label: tmpl.label,
      durationMs: tmpl.durationMs,
      dependsOn: [nodeId, ...(tmpl.dependsOn ?? [])],
    };
    byId.set(node.id, node);
    created.push(node);
  }
  return created;
}
