import type { Dag } from "./types";

export function validateDag(dag: Dag): string[] {
  const errors: string[] = [];
  const ids = new Set(dag.nodes.map((n) => n.id));

  if (ids.size !== dag.nodes.length) {
    errors.push("Duplicate node ids found.");
  }

  for (const node of dag.nodes) {
    for (const dep of node.dependsOn) {
      if (!ids.has(dep)) {
        errors.push(`Node "${node.id}" depends on unknown node "${dep}".`);
      }
    }
  }

  const cycle = findCycle(dag);
  if (cycle) {
    errors.push(`Cycle detected: ${cycle.join(" -> ")}`);
  }

  for (const node of dag.nodes) {
    if (!node.spawns) continue;
    if (node.spawns.outcomes.length === 0) {
      errors.push(`Node "${node.id}" has a spawn rule with no outcomes.`);
      continue;
    }
    for (const outcome of node.spawns.outcomes) {
      const templateIds = new Set(outcome.nodes.map((t) => t.id));
      for (const tmpl of outcome.nodes) {
        if (ids.has(tmpl.id)) {
          errors.push(
            `Node "${node.id}" outcome "${outcome.label}" spawns "${tmpl.id}", which collides with an existing node id.`,
          );
        }
        for (const dep of tmpl.dependsOn ?? []) {
          if (dep !== node.id && !ids.has(dep) && !templateIds.has(dep)) {
            errors.push(
              `Node "${node.id}" outcome "${outcome.label}" spawn "${tmpl.id}" depends on unknown node "${dep}".`,
            );
          }
        }
      }
    }
  }

  return errors;
}

function findCycle(dag: Dag): string[] | null {
  const graph = new Map(dag.nodes.map((n) => [n.id, n.dependsOn]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(dag.nodes.map((n) => [n.id, WHITE]));
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    color.set(id, GRAY);
    stack.push(id);
    for (const dep of graph.get(id) ?? []) {
      if (color.get(dep) === GRAY) {
        const start = stack.indexOf(dep);
        return [...stack.slice(start), dep];
      }
      if (color.get(dep) === WHITE) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const node of dag.nodes) {
    if (color.get(node.id) === WHITE) {
      const found = visit(node.id);
      if (found) return found;
    }
  }
  return null;
}
