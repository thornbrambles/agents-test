export interface DagNode {
  id: string;
  label: string;
  /** Simulated work duration in ms. */
  durationMs: number;
  dependsOn: string[];
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
