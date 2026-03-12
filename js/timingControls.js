export function initTimingControls(state, els, onChange) {
  const syncFromState = () => {
    els.holeDelayMin.value = state.timing.holeToHole.min;
    els.holeDelayMax.value = state.timing.holeToHole.max;
    els.rowDelayMin.value = state.timing.rowToRow.min;
    els.rowDelayMax.value = state.timing.rowToRow.max;
  };

  const syncToState = () => {
    state.timing.holeToHole.min = Number(els.holeDelayMin.value) || 0;
    state.timing.holeToHole.max = Number(els.holeDelayMax.value) || 0;
    state.timing.rowToRow.min = Number(els.rowDelayMin.value) || 0;
    state.timing.rowToRow.max = Number(els.rowDelayMax.value) || 0;
    onChange();
  };

  [els.holeDelayMin, els.holeDelayMax, els.rowDelayMin, els.rowDelayMax].forEach((input) => {
    input.addEventListener("input", syncToState);
  });

  syncFromState();
  return { syncFromState, syncToState };
}