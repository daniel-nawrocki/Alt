function nextColorHint(rowId) {
  const hue = (Number(rowId) * 53) % 360;
  return `hsl(${hue} 70% 45%)`;
}

export function ensureRow(state, rowId) {
  const id = Number(rowId);
  if (!Number.isFinite(id) || id < 1) return null;
  if (!state.rows[id]) {
    state.rows[id] = {
      id,
      holeIds: [],
      rowOrder: id,
      numberingStart: 1,
      customOrderNumbers: {},
      startReference: null,
      offsetInfo: { type: "manual", note: "" },
      colorHint: nextColorHint(id),
    };
  }
  return state.rows[id];
}

function projectionOrder(holes) {
  if (holes.length <= 1) return holes.map((h) => h.id);

  const xs = holes.map((h) => h.x);
  const ys = holes.map((h) => h.y);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  const axis = spreadX >= spreadY ? "x" : "y";

  return [...holes]
    .sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y))
    .map((h) => h.id);
}

function removeCustomOrderForHole(row, holeId) {
  if (!row?.customOrderNumbers) return;
  Object.keys(row.customOrderNumbers).forEach((id) => {
    if (id === String(holeId)) delete row.customOrderNumbers[id];
  });
}

export function assignHolesToRow(state, rowId, holeIds) {
  const row = ensureRow(state, rowId);
  if (!row) return;

  const uniqueIds = [...new Set(holeIds)];
  uniqueIds.forEach((holeId) => {
    const hole = state.holesById.get(holeId);
    if (!hole) return;
    if (hole.rowId !== null && state.rows[hole.rowId]) {
      state.rows[hole.rowId].holeIds = state.rows[hole.rowId].holeIds.filter((id) => id !== holeId);
      removeCustomOrderForHole(state.rows[hole.rowId], holeId);
    }
    hole.rowId = row.id;
  });

  row.holeIds = projectionOrder(
    state.holes.filter((h) => h.rowId === row.id)
  );

  applyRowOrderNumbers(state, row.id);
}

export function assignOrderedHolesToRow(state, rowId, orderedHoleIds, options = {}) {
  const row = ensureRow(state, rowId);
  if (!row) return;
  const append = options.append !== false;
  const preventCrossRow = options.preventCrossRow === true;
  const incoming = [...new Set(orderedHoleIds)];
  let nextOrder = append ? [...row.holeIds] : [];

  incoming.forEach((holeId) => {
    const hole = state.holesById.get(holeId);
    if (!hole) return;
    if (preventCrossRow && hole.rowId !== null && hole.rowId !== row.id) return;
    if (hole.rowId !== null && state.rows[hole.rowId]) {
      state.rows[hole.rowId].holeIds = state.rows[hole.rowId].holeIds.filter((id) => id !== holeId);
      removeCustomOrderForHole(state.rows[hole.rowId], holeId);
    }
    hole.rowId = row.id;
    if (!nextOrder.includes(holeId)) nextOrder.push(holeId);
  });

  row.holeIds = nextOrder;
  applyRowOrderNumbers(state, row.id);
}

export function applyRowOrderNumbers(state, rowId) {
  const row = state.rows[rowId];
  if (!row) return;
  const start = Number.isFinite(Number(row.numberingStart)) ? Number(row.numberingStart) : 1;
  row.numberingStart = start;
  if (!row.customOrderNumbers || typeof row.customOrderNumbers !== "object") row.customOrderNumbers = {};

  const assigned = new Set();
  row.holeIds.forEach((id) => {
    const override = Number(row.customOrderNumbers[id]);
    if (!Number.isFinite(override) || override < 1) {
      delete row.customOrderNumbers[id];
      return;
    }
    const hole = state.holesById.get(id);
    if (!hole) return;
    hole.orderInRow = Math.floor(override);
    assigned.add(hole.orderInRow);
  });

  let next = start;
  row.holeIds.forEach((id) => {
    const hole = state.holesById.get(id);
    if (!hole) return;
    if (Number.isFinite(Number(row.customOrderNumbers[id]))) return;
    while (assigned.has(next)) next += 1;
    hole.orderInRow = next;
    assigned.add(next);
    next += 1;
  });
}

export function setRowNumberingStart(state, rowId, startNumber) {
  const row = state.rows[rowId];
  const n = Number(startNumber);
  if (!row || !Number.isFinite(n) || n < 1) return false;
  row.numberingStart = Math.floor(n);
  applyRowOrderNumbers(state, rowId);
  return true;
}

export function clearHolesFromRows(state, holeIds) {
  holeIds.forEach((holeId) => {
    const hole = state.holesById.get(holeId);
    if (!hole || hole.rowId === null) return;
    const row = state.rows[hole.rowId];
    if (row) row.holeIds = row.holeIds.filter((id) => id !== holeId);
    if (row) removeCustomOrderForHole(row, holeId);
    hole.rowId = null;
    hole.orderInRow = null;
    if (row) applyRowOrderNumbers(state, row.id);
  });
}

export function deleteRow(state, rowId) {
  const id = Number(rowId);
  const row = state.rows[id];
  if (!row) return;
  row.holeIds.forEach((holeId) => {
    const hole = state.holesById.get(holeId);
    if (hole) {
      hole.rowId = null;
      hole.orderInRow = null;
    }
  });
  delete state.rows[id];
}

export function renumberRow(state, fromId, toId) {
  const src = Number(fromId);
  const dst = Number(toId);
  if (src === dst) return true;
  if (!state.rows[src] || state.rows[dst] || dst < 1) return false;

  const row = state.rows[src];
  delete state.rows[src];
  row.id = dst;
  row.rowOrder = dst;
  state.rows[dst] = row;

  row.holeIds.forEach((holeId) => {
    const hole = state.holesById.get(holeId);
    if (hole) hole.rowId = dst;
  });

  Object.values(state.rows).forEach((r) => {
    if (r.startReference?.referenceRow === src) r.startReference.referenceRow = dst;
  });

  return true;
}

export function setRowStartReference(state, rowId, referenceRow, referenceHoleIndex) {
  const row = state.rows[rowId];
  if (!row) return false;
  if (!state.rows[referenceRow]) return false;
  row.startReference = {
    referenceRow: Number(referenceRow),
    referenceHoleIndex: Number(referenceHoleIndex),
  };
  return true;
}

export function setHoleOrderNumber(state, rowId, holeId, holeOrder) {
  const row = state.rows[rowId];
  const hole = state.holesById.get(holeId);
  if (!row || !hole || hole.rowId !== row.id) return false;
  if (!row.customOrderNumbers || typeof row.customOrderNumbers !== "object") row.customOrderNumbers = {};

  if (holeOrder === null || holeOrder === undefined || holeOrder === "") {
    delete row.customOrderNumbers[holeId];
    applyRowOrderNumbers(state, row.id);
    return true;
  }

  const n = Math.floor(Number(holeOrder));
  if (!Number.isFinite(n) || n < 1) return false;

  const start = Number.isFinite(Number(row.numberingStart)) ? Math.floor(Number(row.numberingStart)) : 1;
  const currentById = {};
  row.holeIds.forEach((id, idx) => {
    const h = state.holesById.get(id);
    const fallback = start + idx;
    currentById[id] = Number.isFinite(Number(h?.orderInRow)) ? Math.floor(Number(h.orderInRow)) : fallback;
  });

  const current = currentById[holeId];
  if (!Number.isFinite(current)) return false;

  const delta = n - current;
  const nextById = {};
  row.holeIds.forEach((id) => {
    const order = currentById[id];
    if (id === String(holeId)) {
      nextById[id] = n;
      return;
    }
    if (delta > 0 && order > current) {
      nextById[id] = order + delta;
      return;
    }
    if (delta < 0 && order >= n && order < current) {
      nextById[id] = order + delta;
      return;
    }
    nextById[id] = order;
  });

  row.customOrderNumbers = {};
  Object.entries(nextById).forEach(([id, order]) => {
    row.customOrderNumbers[id] = order;
  });
  applyRowOrderNumbers(state, row.id);
  return true;
}

export function rowSummary(state) {
  return Object.values(state.rows)
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .map((row) => {
      const numberStart = Number.isFinite(Number(row.numberingStart)) ? Number(row.numberingStart) : 1;
      return `Row ${row.id}: ${row.holeIds.length} holes, numbering starts at ${numberStart}`;
    });
}
