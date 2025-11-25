/* Simple DXF extent extractor for LINE entities on a given layer (default: "0")
   Usage: node scripts/extract-dxf-extents.js "/absolute/path/to/file.dxf" [layerName]
   Outputs: JSON with units (mm), width/depth (mm, cm), and bounds.
*/

const fs = require('fs');
const path = require('path');

function parseDxfExtents(filePath, targetLayer = '0') {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  let i = 0;
  let inEntity = false;
  let currentEntityType = null;
  let layer = null;
  let sx = null, sy = null, ex = null, ey = null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let countedSegments = 0;

  function flushLine() {
    if (layer === targetLayer && sx != null && sy != null && ex != null && ey != null) {
      // update bounds with both endpoints
      if (sx < minX) minX = sx;
      if (ex < minX) minX = ex;
      if (sy < minY) minY = sy;
      if (ey < minY) minY = ey;
      if (sx > maxX) maxX = sx;
      if (ex > maxX) maxX = ex;
      if (sy > maxY) maxY = sy;
      if (ey > maxY) maxY = ey;
      countedSegments += 1;
    }
    // reset entity fields
    layer = null; sx = sy = ex = ey = null;
  }

  while (i < lines.length) {
    const code = lines[i++]?.trim();
    const value = lines[i++] ?? '';
    if (code === undefined) break;

    if (code === '0') {
      // starting a new entity
      // if we were in a LINE, flush
      if (inEntity && currentEntityType === 'LINE') {
        flushLine();
      }
      inEntity = true;
      currentEntityType = value.trim();
      // reset per-entity
      layer = null; sx = sy = ex = ey = null;
      continue;
    }

    if (!inEntity) continue;

    // We only support LINE entities for now
    if (currentEntityType === 'LINE') {
      switch (code) {
        case '8': // layer
          layer = value.trim();
          break;
        case '10':
          sx = parseFloat(value);
          break;
        case '20':
          sy = parseFloat(value);
          break;
        case '11':
          ex = parseFloat(value);
          break;
        case '21':
          ey = parseFloat(value);
          break;
        default:
          break;
      }
    }
  }

  // flush last line if file ended during entity
  if (inEntity && currentEntityType === 'LINE') {
    flushLine();
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return {
      ok: false,
      message: 'No LINE entities found on the specified layer',
      layer: targetLayer,
      countedSegments,
    };
  }

  const widthMm = maxX - minX;
  const depthMm = maxY - minY;
  return {
    ok: true,
    units: 'mm',
    layer: targetLayer,
    countedSegments,
    bounds: { minX, minY, maxX, maxY },
    width: { mm: widthMm, cm: widthMm / 10 },
    depth: { mm: depthMm, cm: depthMm / 10 },
  };
}

function main() {
  const filePath = process.argv[2];
  const layer = process.argv[3] || '0';
  if (!filePath) {
    console.error('Usage: node scripts/extract-dxf-extents.js "/absolute/path/to/file.dxf" [layerName]');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(2);
  }
  const result = parseDxfExtents(abs, layer);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}


