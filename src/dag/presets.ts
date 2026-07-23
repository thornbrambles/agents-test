import type { Dag } from "./types";

export const presets: Dag[] = [
  {
    name: "Diamond",
    nodes: [
      { id: "A", label: "Fetch data", durationMs: 400, dependsOn: [] },
      { id: "B", label: "Parse", durationMs: 300, dependsOn: ["A"] },
      { id: "C", label: "Validate", durationMs: 300, dependsOn: ["A"] },
      { id: "D", label: "Merge", durationMs: 200, dependsOn: ["B", "C"] },
    ],
  },
  {
    name: "Fan-out / fan-in",
    nodes: [
      { id: "start", label: "Plan build", durationMs: 200, dependsOn: [] },
      { id: "job1", label: "Build: linux", durationMs: 600, dependsOn: ["start"] },
      { id: "job2", label: "Build: mac", durationMs: 700, dependsOn: ["start"] },
      { id: "job3", label: "Build: windows", durationMs: 550, dependsOn: ["start"] },
      { id: "job4", label: "Build: web", durationMs: 450, dependsOn: ["start"] },
      { id: "collect", label: "Collect artifacts", durationMs: 250, dependsOn: ["job1", "job2", "job3", "job4"] },
      { id: "publish", label: "Publish release", durationMs: 300, dependsOn: ["collect"] },
    ],
  },
  {
    name: "Wide & parallel",
    nodes: Array.from({ length: 8 }, (_, i) => ({
      id: `t${i}`,
      label: `Independent task ${i}`,
      durationMs: 300 + ((i * 137) % 400),
      dependsOn: [],
    })),
  },
  {
    name: "Long chain",
    nodes: Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      label: `Step ${i}`,
      durationMs: 350,
      dependsOn: i === 0 ? [] : [`s${i - 1}`],
    })),
  },
];
