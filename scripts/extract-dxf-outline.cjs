/* Extract an ordered polygon outline from LINE entities on a target layer.
   Usage: node scripts/extract-dxf-outline.cjs "/abs/path/file.dxf" "Layer Name"
   Output: JSON with pointsCm centered at (0,0), bboxCm, closed flag.
*/

const fs = require('fs');
const path = require('path');

function parseLinesOnLayer(filePath, targetLayer) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let i = 0;
  let inEntity = false;
  let type = null;
  let layer = null;
  let sx = null, sy = null, ex = null, ey = null;
  const segs = [];

  function flush() {
    if (type === 'LINE' && layer === targetLayer && sx != null && sy != null && ex != null && ey != null) {
      segs.push({ x1: parseFloat(sx), y1: parseFloat(sy), x2: parseFloat(ex), y2: parseFloat(ey) });
    }
    type = null; layer = null; sx = sy = ex = ey = null;
  }

  while (i < lines.length) {
    const code = lines[i++]?.trim();
    const value = lines[i++] ?? '';
    if (code === undefined) break;

    if (code === '0') {
      if (inEntity) flush();
      inEntity = true;
      type = value.trim();
      layer = null; sx = sy = ex = ey = null;
      continue;
    }
    if (!inEntity) continue;

    if (type === 'LINE') {
      switch (code) {
        case '8': layer = value.trim(); break;
        case '10': sx = value; break;
        case '20': sy = value; break;
        case '11': ex = value; break;
        case '21': ey = value; break;
      }
    }
  }
  if (inEntity) flush();
  return segs;
}

function roundKey(x, y, tol = 1e-3) {
  return `${Math.round(x / tol) * tol},${Math.round(y / tol) * tol}`;
}

function buildPolygonFromSegments(segs) {
  if (!segs.length) return { ok: false, message: 'No segments' };
  const adjacency = new Map();
  const edges = new Map(); // key "a|b" to used flag

  function addAdj(ax, ay, bx, by) {
    const ak = roundKey(ax, ay);
    const bk = roundKey(bx, by);
    if (!adjacency.has(ak)) adjacency.set(ak, { pt: { x: ax, y: ay }, next: new Set() });
    if (!adjacency.has(bk)) adjacency.set(bk, { pt: { x: bx, y: by }, next: new Set() });
    adjacency.get(ak).next.add(bk);
    adjacency.get(bk).next.add(ak);
    edges.set(ak + '|' + bk, false);
    edges.set(bk + '|' + ak, false);
  }

  for (const s of segs) addAdj(s.x1, s.y1, s.x2, s.y2);

  // pick start with degree 2; fallback to any
  let startKey = null;
  for (const [k, v] of adjacency) {
    if (v.next.size === 2) { startKey = k; break; }
  }
  if (!startKey) startKey = adjacency.keys().next().value;
  if (!startKey) return { ok: false, message: 'No nodes' };

  // walk a cycle
  const polyKeys = [startKey];
  let prevKey = null;
  let curKey = startKey;
  for (let steps = 0; steps < adjacency.size * 4; steps++) {
    const nbrs = [...(adjacency.get(curKey)?.next ?? [])];
    const nextKey = nbrs.find(n => n !== prevKey && edges.get(curKey + '|' + n) === false);
    if (!nextKey) break;
    edges.set(curKey + '|' + nextKey, true);
    edges.set(nextKey + '|' + curKey, true);
    polyKeys.push(nextKey);
    prevKey = curKey;
    curKey = nextKey;
    if (nextKey === startKey && polyKeys.length > 3) break;
  }

  const closed = polyKeys[0] === polyKeys[polyKeys.length - 1];
  // convert to points (mm)
  let pts = polyKeys.map(k => {
    const { pt } = adjacency.get(k);
    return { x: pt.x, y: pt.y };
  });
  if (!closed) {
    // try to close by adding start
    pts.push(pts[0]);
  }

  // mm -> cm
  pts = pts.map(p => ({ x: p.x / 10, y: p.y / 10 }));

  // center around (0,0) using bbox center
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const centered = pts.map(p => ({ x: p.x - cx, y: p.y - cy }));

  return {
    ok: true,
    closed,
    bboxCm: { width: maxX - minX, depth: maxY - minY },
    pointsCm: centered,
  };
}

function main() {
  const filePath = process.argv[2];
  const layer = process.argv[3];
  if (!filePath || !layer) {
    console.error('Usage: node scripts/extract-dxf-outline.cjs "/abs/path/file.dxf" "Layer Name"');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(2);
  }
  const segs = parseLinesOnLayer(abs, layer);
  const res = buildPolygonFromSegments(segs);
  console.log(JSON.stringify({ layer, segments: segs.length, ...res }, null, 2));
}

if (require.main === module) {
  main();
}


