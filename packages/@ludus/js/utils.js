/**
 * utils.js — core-level helpers shared between @ludus/core modules.
 * App-level helpers (DataStore/State-aware) live in the application's
 * js/utils.js and re-export what they need from here.
 */

export function fillSelect(sel, items) {
  if (!sel) return;
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "Выберите...";
  sel.appendChild(def);
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    sel.appendChild(opt);
  }
}
