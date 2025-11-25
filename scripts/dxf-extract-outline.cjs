/* Extract outline from DXF by sampling LINE and ARC entities into an ordered polygon.
   Usage: node scripts/dxf-extract-outline.cjs "/abs/path/file.dxf" [layerName]
   Output: JSON { ok, layer?, bboxCm, pointsCm } centered, in cm.
*/

const fs = require('fs');
const path = require('path');

function rad(deg) { return (deg * Math.PI) / 180; }

function parseEntities(filePath, targetLayer) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let i = 0;
  let inEntity = false;
  let type = null;
  let layer = null;
  const result = [];

  // Working vars
  let sx = null, sy = null, ex = null, ey = null;
  let cx = null, cy = null, r = null, a0 = null, a1 = null;

  function pushLine() {
    if (layer && (!targetLayer || targetLayer === layer) && sx != null && sy != null && ex != null && ey != null) {
      result.push({ kind: 'line', layer, x1: parseFloat(sx), y1: parseFloat(sy), x2: parseFloat(ex), y2: parseFloat(ey) });
    }
    sx = sy = ex = ey = null;
  }

  function pushArc() {
    if (layer && (!targetLayer || targetLayer === layer) && cx != null && cy != null && r != null && a0 != null && a1 != null) {
      result.push({ kind: 'arc', layer, cx: parseFloat(cx), cy: parseFloat(cy), r: parseFloat(r), a0: parseFloat(a0), a1: parseFloat(a1) });
    }
    cx = cy = r = a0 = a1 = null;
  }

  while (i < lines.length) {
    const code = lines[i++]?.trim();
    const valRaw = lines[i++] ?? '';
    if (code === undefined) break;
    const value = valRaw.trim();

    if (code === '0') {
      // Finish previous entity
      if (inEntity) {
        if (type === 'LINE') pushLine();
        if (type === 'ARC') pushArc();
      }
      // Start new entity
      inEntity = true;
      type = value;
      layer = null;
      sx = sy = ex = ey = null;
      cx = cy = r = a0 = a1 = null;
      continue;
    }
    if (!inEntity) continue;

    switch (type) {
      case 'LINE':
        switch (code) {
          case '8': layer = value; break;
          case '10': sx = value; break;
          case '20': sy = value; break;
          case '11': ex = value; break;
          case '21': ey = value; break;
          default: break;
        }
        break;
      case 'ARC':
        // ARC comes with AcDbCircle + AcDbArc codes
        switch (code) {
          case '8': layer = value; break;
          case '10': cx = value; break;
          case '20': cy = value; break;
          case '40': r = value; break;
          case '50': a0 = value; break; // start angle deg
          case '51': a1 = value; break; // end angle deg
          default: break;
        }
        break;
      default:
        break;
    }
  }
  // Flush last
  if (inEntity) {
    if (type === 'LINE') pushLine();
    if (type === 'ARC') pushArc();
  }
  return result;
}

function sampleEntitiesToSegments(entities) {
  const segs = [];
  for (const e of entities) {
    if (e.kind === 'line') {
      segs.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 });
    } else if (e.kind === 'arc') {
      // Sample arc into small line segments
      let { cx, cy, r, a0, a1 } = e;
      // Normalize angles to [0,360)
      let start = a0;
      let end = a1;
      // Determine sweep direction; DXF arcs go CCW from start to end
      // Ensure positive sweep
      while (end < start) end += 360;
      const sweep = end - start;
      const steps = Math.max(6, Math.min(64, Math.ceil(sweep / 10))); // ~10 deg per segment
      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const ang = start + (sweep * i) / steps;
        const x = cx + r * Math.cos(rad(ang));
        const y = cy + r * Math.sin(rad(ang));
        if (prev) {
          segs.push({ x1: prev.x, y1: prev.y, x2: x, y2: y });
        }
        prev = { x, y };
      }
    }
  }
  return segs;
}

function roundKey(x, y, tol = 1e-3) {
  return `${Math.round(x / tol) * tol},${Math.round(y / tol) * tol}`;
}

function chainSegmentsToPolygon(segs) {
  if (!segs.length) return null;
  const nodes = new Map(); // key -> { pt, neighbors: Set<key> }
  const edgeUsed = new Map();
  function addNode(x, y) {
    const k = roundKey(x, y);
    if (!nodes.has(k)) nodes.set(k, { pt: { x, y }, neighbors: new Set() });
    return k;
  }
  function addEdge(a, b) {
    nodes.get(a).neighbors.add(b);
    nodes.get(b).neighbors.add(a);
    edgeUsed.set(a + '|' + b, false);
    edgeUsed.set(b + '|' + a, false);
  }
  for (const s of segs) {
    const a = addNode(s.x1, s.y1);
    const b = addNode(s.x2, s.y2);
    addEdge(a, b);
  }
  // pick start: lowest y then lowest x
  let startKey = null;
  for (const [k, v] of nodes) {
    if (!startKey) startKey = k;
    const cur = nodes.get(startKey).pt;
    if (v.pt.y < cur.y || (v.pt.y === cur.y && v.pt.x < cur.x)) startKey = k;
  }
  function vec(a, b) {
    const pa = nodes.get(a).pt, pb = nodes.get(b).pt;
    return { x: pb.x - pa.x, y: pb.y - pa.y };
  }
  function angleFrom(u, v) {
    // angle to rotate u CCW to v in [0, 2π)
    const au = Math.atan2(u.y, u.x);
    const av = Math.atan2(v.y, v.x);
    let d = av - au;
    while (d < 0) d += 2 * Math.PI;
    while (d >= 2 * Math.PI) d -= 2 * Math.PI;
    return d;
  }
  const poly = [startKey];
  let prevDir = { x: 1, y: 0 }; // initial to +X
  let curKey = startKey;
  for (let steps = 0; steps < nodes.size * 6; steps++) {
    const nbrs = [...nodes.get(curKey).neighbors];
    const candidates = nbrs.filter((n) => edgeUsed.get(curKey + '|' + n) === false);
    if (!candidates.length) break;
    // choose next with smallest CCW angle from prevDir
    let best = null;
    let bestAng = Infinity;
    for (const n of candidates) {
      const d = vec(curKey, n);
      const ang = angleFrom(prevDir, d);
      if (ang < bestAng) { bestAng = ang; best = n; }
    }
    if (!best) break;
    edgeUsed.set(curKey + '|' + best, true);
    edgeUsed.set(best + '|' + curKey, true);
    prevDir = vec(curKey, best);
    poly.push(best);
    curKey = best;
    if (curKey === startKey && poly.length > 3) break;
  }
  let points = poly.map((k) => nodes.get(k).pt);
  if (poly[poly.length - 1] !== startKey) points.push(points[0]);
  return points;
}

function main() {
  const filePath = process.argv[2];
  const layerName = process.argv[3] || undefined;
  if (!filePath) {
    console.error('Usage: node scripts/dxf-extract-outline.cjs \"/abs/path/file.dxf\" [layerName]');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(2);
  }
  const entities = parseEntities(abs, layerName);
  if (!entities.length) {
    console.log(JSON.stringify({ ok: false, message: 'No LINE/ARC entities found' }, null, 2));
    process.exit(0);
  }
  const segs = sampleEntitiesToSegments(entities);
  const poly = chainSegmentsToPolygon(segs);
  if (!poly || poly.length < 4) {
    console.log(JSON.stringify({ ok: false, message: 'Failed to chain segments into polygon' }, null, 2));
    process.exit(0);
  }
  // mm -> cm, bbox, center
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    const xcm = p.x / 10, ycm = p.y / 10;
    if (xcm < minX) minX = xcm;
    if (ycm < minY) minY = ycm;
    if (xcm > maxX) maxX = xcm;
    if (ycm > maxY) maxY = ycm;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pointsCm = poly.map((p) => ({ x: p.x / 10 - cx, y: p.y / 10 - cy }));
  const out = {
    ok: true,
    bboxCm: { width: maxX - minX, depth: maxY - minY },
    pointsCm,
  };
  console.log(JSON.stringify(out, null, 2));
}

if (require.main === module) main();


