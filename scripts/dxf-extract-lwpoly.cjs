/* Extract first LWPOLYLINE (closed) from DXF and output centered points in cm.
   Usage: node scripts/dxf-extract-lwpoly.cjs "/abs/path/file.dxf" [layerName]
   Output: JSON { ok, layer, closed, bboxCm, pointsCm }
*/

const fs = require('fs');
const path = require('path');

function parseFirstOutline(filePath, targetLayer) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let i = 0;
  let inEntity = false;
  let type = null;
  let layer = null;
  let vertices = [];
  let flags = 0;
  let found = null;
  let inPolySeq = false; // for old POLYLINE/VERTEX/SEQEND

  function maybeFinish() {
    if ((type === 'LWPOLYLINE' || type === 'POLYLINE') && vertices.length >= 2) {
      if (targetLayer && layer !== targetLayer) return;
      found = { layer, flags, vertices: vertices.slice() };
    }
  }

  while (i < lines.length && !found) {
    const code = lines[i++]?.trim();
    const valueRaw = lines[i++] ?? '';
    if (code === undefined) break;
    const value = valueRaw.trim();

    if (code === '0') {
      if (inEntity) maybeFinish();
      inEntity = true;
      type = value;
      // reset
      layer = null;
      vertices = [];
      flags = 0;
      continue;
    }
    if (!inEntity) continue;

    if (type === 'LWPOLYLINE') {
      switch (code) {
        case '8': // layer
          layer = value;
          break;
        case '70': // flags (bit 1 closed)
          flags = parseInt(value, 10) || 0;
          break;
        case '10': // x
          {
            const x = parseFloat(value);
            // next group should include 20 y at some later point
            // We'll push placeholder and fill y when we see 20
            vertices.push({ x, y: null });
          }
          break;
        case '20': // y
          {
            // assign to last vertex without y
            for (let idx = vertices.length - 1; idx >= 0; idx--) {
              if (vertices[idx].y === null) {
                vertices[idx].y = parseFloat(value);
                break;
              }
            }
          }
          break;
        default:
          break;
      }
    } else if (type === 'POLYLINE' || (inPolySeq && type === 'VERTEX')) {
      // Old-style polyline sequence
      if (type === 'POLYLINE') {
        switch (code) {
          case '8':
            layer = value;
            break;
          case '70':
            flags = parseInt(value, 10) || 0;
            break;
          default:
            break;
        }
        // POLYLINE begins sequence
        inPolySeq = true;
      } else if (type === 'VERTEX') {
        switch (code) {
          case '10': {
            const x = parseFloat(value);
            vertices.push({ x, y: null });
            break;
          }
          case '20': {
            for (let idx = vertices.length - 1; idx >= 0; idx--) {
              if (vertices[idx].y === null) {
                vertices[idx].y = parseFloat(value);
                break;
              }
            }
            break;
          }
          default:
            break;
        }
      } else if (type === 'SEQEND') {
        // End of poly sequence
        maybeFinish();
        inPolySeq = false;
      }
    }
  }
  if (!found) {
    // handle end of file
    if (inEntity) maybeFinish();
  }
  if (!found) return { ok: false, message: 'No LWPOLYLINE/POLYLINE found' };

  // Filter out any incomplete vertices
  const pts = found.vertices.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  // Convert mm -> cm
  const ptsCm = pts.map((p) => ({ x: p.x / 10, y: p.y / 10 }));
  // Compute bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ptsCm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Center points
  const centered = ptsCm.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  const closed = (found.flags & 1) === 1;

  return {
    ok: true,
    layer: found.layer,
    closed,
    bboxCm: { width: maxX - minX, depth: maxY - minY },
    pointsCm: centered,
  };
}

function main() {
  const filePath = process.argv[2];
  const layerName = process.argv[3] || undefined;
  if (!filePath) {
    console.error('Usage: node scripts/dxf-extract-lwpoly.cjs "/abs/path/file.dxf" [layerName]');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(2);
  }
  const res = parseFirstOutline(abs, layerName);
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) main();


