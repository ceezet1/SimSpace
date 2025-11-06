export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function snapToGridCm(valueCm: number, gridCm: number): number {
  if (gridCm <= 0) return valueCm;
  return Math.round(valueCm / gridCm) * gridCm;
}

export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  angleDeg: number
): { x: number; y: number } {
  const a = degToRad(angleDeg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

export function rectCorners(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotationDeg: number
): Array<{ x: number; y: number }> {
  const hw = width / 2;
  const hh = height / 2;
  const pts = [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
  return pts.map((p) => rotatePoint(p.x, p.y, cx, cy, rotationDeg));
}


