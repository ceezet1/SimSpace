import { readFileSync } from 'node:fs';
import bounds from 'svg-path-bounds';
import { svgPathProperties } from 'svg-path-properties';

const source = readFileSync(new URL('../src/assets/proSvgPath.ts', import.meta.url), 'utf8');
const pathMatch = source.match(/PRO_N_SVG_PATH_D\s*=\s*`([\s\S]*?)`;/);
if (!pathMatch) {
  console.error('Unable to find PRO_N_SVG_PATH_D in src/assets/proSvgPath.ts');
  process.exit(1);
}

const viewboxMatch = source.match(/PRO_N_VIEWBOX_WIDTH\s*=\s*(\d+)/);
if (!viewboxMatch) {
  console.error('Unable to find PRO_N_VIEWBOX_WIDTH in src/assets/proSvgPath.ts');
  process.exit(1);
}

const pathD = pathMatch[1];
const viewboxWidth = Number(viewboxMatch[1]);

const [minX, minY, maxX, maxY] = bounds(pathD);
const width = maxX - minX;
const height = maxY - minY;
const leftRatio = minX / viewboxWidth;
const rightRatio = maxX / viewboxWidth;

const props = new svgPathProperties(pathD);
const length = props.getTotalLength();
const bandHeight = 300; // viewbox units near the very top
let monitorMinX = Infinity;
let monitorMaxX = -Infinity;
const samples = 20000;
for (let i = 0; i <= samples; i += 1) {
  const point = props.getPointAtLength((length * i) / samples);
  if (point.y <= minY + bandHeight) {
    monitorMinX = Math.min(monitorMinX, point.x);
    monitorMaxX = Math.max(monitorMaxX, point.x);
  }
}
const monitorLeftRatio = monitorMinX / viewboxWidth;
const monitorRightRatio = monitorMaxX / viewboxWidth;

console.log(
  JSON.stringify(
    {
      minX,
      maxX,
      minY,
      maxY,
      width,
      height,
      viewboxWidth,
      leftRatio,
      rightRatio,
      monitorBandHeight: bandHeight,
      monitorMinX,
      monitorMaxX,
      monitorLeftRatio,
      monitorRightRatio,
    },
    null,
    2,
  ),
);

