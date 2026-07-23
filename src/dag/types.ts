export type NodeKind = "job" | "agent";

export interface SpawnTemplate {
  id: string;
  label: string;
  durationMs: number;
  /** Extra deps beyond the implicit dependency on the node that spawned it. */
  dependsOn?: string[];
  kind?: NodeKind;
}

export interface SpawnOutcome {
  label: string;
  /** Relative probability; defaults to 1. */
  weight?: number;
  nodes: SpawnTemplate[];
}

export interface SpawnRule {
  outcomes: SpawnOutcome[];
}

export interface DagNode {
  id: string;
  label: string;
  /** Simulated work duration in ms. */
  durationMs: number;
  dependsOn: string[];
  /**
   * "agent" nodes are throttled by the shared agent-concurrency limit (a
   * stand-in for an LLM API rate limit); "job" (the default) nodes are
   * deterministic work that isn't subject to that limit.
   */
  kind?: NodeKind;
  /**
   * Optional: once this node finishes, deterministically pick one outcome
   * (seeded by the run seed + this node's id, so the choice never depends on
   * execution order) and splice its nodes into the graph as new dependents.
   * Models a node whose result ("what it sees") decides what work appears next.
   */
  spawns?: SpawnRule;
}

export interface Dag {
  name: string;
  nodes: DagNode[];
}

export interface TimelineEntry {
  nodeId: string;
  label: string;
  /** ms since run start */
  start: number;
  end: number;
  /** which worker/actor slot handled it, for lane rendering */
  lane: number;
  kind: NodeKind;
}

export interface RunResult {
  strategy: "beads" | "actors";
  entries: TimelineEntry[];
  totalMs: number;
}
