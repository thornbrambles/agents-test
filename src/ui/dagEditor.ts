import type { Dag } from "../dag/types";
import { presets } from "../dag/presets";
import { validateDag } from "../dag/validate";

export function initDagEditor(): { getDag: () => Dag | null } {
  const select = document.getElementById("preset-select") as HTMLSelectElement;
  const textarea = document.getElementById("dag-json") as HTMLTextAreaElement;
  const errorsEl = document.getElementById("dag-errors")!;
  const validateBtn = document.getElementById("validate-btn")!;

  for (const preset of presets) {
    const opt = document.createElement("option");
    opt.value = preset.name;
    opt.textContent = preset.name;
    select.appendChild(opt);
  }

  function loadPreset(name: string): void {
    const preset = presets.find((p) => p.name === name) ?? presets[0];
    textarea.value = JSON.stringify(preset, null, 2);
    errorsEl.textContent = "";
  }

  select.addEventListener("change", () => loadPreset(select.value));
  loadPreset(presets[0].name);

  function getDag(): Dag | null {
    let dag: Dag;
    try {
      dag = JSON.parse(textarea.value);
    } catch {
      errorsEl.textContent = "Invalid JSON.";
      return null;
    }
    const errors = validateDag(dag);
    errorsEl.textContent = errors.join(" ");
    return errors.length === 0 ? dag : null;
  }

  validateBtn.addEventListener("click", () => {
    const dag = getDag();
    if (dag) errorsEl.textContent = "Looks good — no cycles or missing dependencies.";
  });

  return { getDag };
}
