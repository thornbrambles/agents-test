export interface SpawnTemplate {
  id: string;
  label: string;
  durationMs: number;
  /** Extra deps beyond the implicit dependency on the node that spawned it. */
  dependsOn?: string[];
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
}

export interface RunResult {
  strategy: "beads" | "actors";
  entries: TimelineEntry[];
  totalMs: number;
}
