let pathCounter = 1;

export function startNewPath(state, direction = "forward") {
  const path = {
    id: `P-${pathCounter++}`,
    direction,
    holeIds: [],
  };
  state.initiation.paths.push(path);
  state.initiation.activePathId = path.id;
  return path;
}

export function addHoleToActivePath(state, holeId) {
  let active = state.initiation.paths.find((p) => p.id === state.initiation.activePathId);
  if (!active) {
    active = startNewPath(state, "forward");
  }
  if (active.holeIds[active.holeIds.length - 1] === holeId) return;
  active.holeIds.push(holeId);
}

export function clearPaths(state) {
  state.initiation.paths = [];
  state.initiation.activePathId = null;
}

export function setDirectionForActivePath(state, direction) {
  const active = state.initiation.paths.find((p) => p.id === state.initiation.activePathId);
  if (active) active.direction = direction;
}