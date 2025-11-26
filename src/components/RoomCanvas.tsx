function describeMonitorArc(x: number, y: number, chordLengthPx: number, radiusPx: number, concaveDown = false): string {
  const halfChord = chordLengthPx / 2;
  const limitedRadius = Math.max(radiusPx, halfChord + 1);
  const endX = x + chordLengthPx;
  const sweepFlag = concaveDown ? 1 : 0;
  return `M ${x} ${y} A ${limitedRadius} ${limitedRadius} 0 0 ${sweepFlag} ${endX} ${y}`;
}
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ProjectState, PlacedObject, Door } from '../types';
import { clamp, snapToGridCm } from '../utils/geometry';
import { ProShape } from './ProShape';
import { ProAmShape } from './ProAmShape';
import { PRO_N_MONITOR_EDGE_RATIOS, PRO_AM_MONITOR_EDGE_RATIOS } from '../assets/proSvgPath';

interface CanvasProps {
  state: ProjectState;
  dispatch: React.Dispatch<any>;
  selected: PlacedObject | null;
}

export const RoomCanvas: React.FC<CanvasProps> = ({ state, dispatch, selected }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ xCm: number; yCm: number; pointerX: number; pointerY: number } | null>(null);

  const { pxPerCm, panX, panY, snapCm } = state.canvas;
  const roomW = state.room.widthCm;
  const roomD = state.room.depthCm;
  const unitsLabel = state.units === 'metric' ? 'cm' : 'in';
  function toDisplayUnitsVal(cm: number): number {
    return state.units === 'metric' ? cm : cm / 2.54;
  }

  // Fits an arbitrary SVG path into a target rectangle (in pixels) by measuring its bbox at runtime.
  const FittedPath: React.FC<{
    d: string;
    targetWidthPx: number;
    targetHeightPx: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    pathTransform?: string;
    fitMode?: 'contain' | 'width' | 'height' | 'stretch';
    debugBoxMode?: 'none' | 'target' | 'shape' | 'both';
  }> = ({ d, targetWidthPx, targetHeightPx, fill, stroke, strokeWidth = 1, opacity = 1, pathTransform, fitMode = 'contain', debugBoxMode = 'none' }) => {
    const nodeRef = useRef<SVGGElement | SVGPathElement | null>(null);
    const [bbox, setBbox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    useLayoutEffect(() => {
      if (nodeRef.current) {
        const b = (nodeRef.current as any).getBBox?.();
        if (b && isFinite(b.width) && isFinite(b.height) && b.width > 0 && b.height > 0) {
          setBbox({ x: b.x, y: b.y, width: b.width, height: b.height });
        }
      }
    }, [d]);
    if (!bbox) {
      // Render once invisibly to measure
      return pathTransform ? (
        <g ref={nodeRef as any} transform={pathTransform}>
          <path d={d} fill="none" stroke="transparent" />
        </g>
      ) : (
        <path ref={nodeRef as any} d={d} fill="none" stroke="transparent" />
      );
    }
    const baseScaleX = targetWidthPx / bbox.width;
    const baseScaleY = targetHeightPx / bbox.height;
    let useScaleX = baseScaleX;
    let useScaleY = baseScaleY;
    if (fitMode === 'contain') {
      const uni = Math.min(baseScaleX, baseScaleY);
      useScaleX = uni;
      useScaleY = uni;
    } else if (fitMode === 'width') {
      useScaleX = baseScaleX;
      useScaleY = baseScaleX;
    } else if (fitMode === 'height') {
      useScaleX = baseScaleY;
      useScaleY = baseScaleY;
    } // 'stretch' uses baseScaleX/baseScaleY as-is
    const tx = -bbox.x;
    const ty = -bbox.y;
    const offsetX = (targetWidthPx - bbox.width * useScaleX) / 2;
    const offsetY = (targetHeightPx - bbox.height * useScaleY) / 2;
    const transform = `translate(${offsetX}, ${offsetY}) scale(${useScaleX}, ${useScaleY}) translate(${tx}, ${ty})`;
    return (
      <>
        {(debugBoxMode === 'target' || debugBoxMode === 'both') && (
          <rect
            x={0}
            y={0}
            width={targetWidthPx}
            height={targetHeightPx}
            fill="none"
            stroke="var(--muted)"
            strokeDasharray="6 4"
            strokeWidth={1}
            opacity={0.8}
          />
        )}
        {(debugBoxMode === 'shape' || debugBoxMode === 'both') && (
          <rect
            x={offsetX}
            y={offsetY}
            width={bbox.width * useScaleX}
            height={bbox.height * useScaleY}
            fill="none"
            stroke="var(--muted)"
            strokeDasharray="6 4"
            strokeWidth={1}
            opacity={0.8}
          />
        )}
      <g transform={transform}>
        {pathTransform ? (
          <g transform={pathTransform}>
            <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth / Math.max(useScaleX, useScaleY)} opacity={opacity} />
          </g>
        ) : (
          <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth / Math.max(useScaleX, useScaleY)} opacity={opacity} />
        )}
      </g>
      </>
    );
  };

  const FittedPolygon: React.FC<{
    pointsCm: Array<{ x: number; y: number }>;
    targetWidthPx: number;
    targetHeightPx: number;
    fill: string;
    stroke: string;
    strokeWidth?: number;
    opacity?: number;
    rotateDeg?: number;
  }> = ({ pointsCm, targetWidthPx, targetHeightPx, fill, stroke, strokeWidth = 1, opacity = 1, rotateDeg = 0 }) => {
    if (!pointsCm.length) return null;
    // Compute bbox in cm
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pointsCm) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const widthCm = Math.max(1e-6, maxX - minX);
    const heightCm = Math.max(1e-6, maxY - minY);
    // Scale to target px
    const sx = targetWidthPx / (widthCm * pxPerCm);
    const sy = targetHeightPx / (heightCm * pxPerCm);
    const s = Math.min(sx, sy);
    // Convert cm -> px with center alignment
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rad = (rotateDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const pts = pointsCm.map((p) => {
      // rotate about center before scaling
      const dx = p.x - cx;
      const dy = p.y - cy;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      const xpx = rx * pxPerCm * s + targetWidthPx / 2;
      const ypx = ry * pxPerCm * s + targetHeightPx / 2;
      return `${xpx},${ypx}`;
    }).join(' ');
    // Use nonzero to avoid diagonal cuts from self-crossing outlines
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} fillRule="nonzero" />;
  };

  const FittedPolyline: React.FC<{
    pointsCm: Array<{ x: number; y: number }>;
    targetWidthPx: number;
    targetHeightPx: number;
    stroke: string;
    strokeWidth?: number;
    opacity?: number;
    rotateDeg?: number;
  }> = ({ pointsCm, targetWidthPx, targetHeightPx, stroke, strokeWidth = 2, opacity = 1, rotateDeg = 0 }) => {
    if (!pointsCm.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pointsCm) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const widthCm = Math.max(1e-6, maxX - minX);
    const heightCm = Math.max(1e-6, maxY - minY);
    const sx = targetWidthPx / (widthCm * pxPerCm);
    const sy = targetHeightPx / (heightCm * pxPerCm);
    const s = Math.min(sx, sy);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rad = (rotateDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const pts = pointsCm.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      const xpx = rx * pxPerCm * s + targetWidthPx / 2;
      const ypx = ry * pxPerCm * s + targetHeightPx / 2;
      return `${xpx},${ypx}`;
    }).join(' ');
    return <polyline points={pts} fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
  };

  const widthPx = useMemo(() => svgRef.current?.clientWidth ?? 0, []);
  const heightPx = useMemo(() => svgRef.current?.clientHeight ?? 0, []);

  function cmToPxX(cm: number): number { return cm * pxPerCm + panX; }
  function cmToPxY(cm: number): number { return cm * pxPerCm + panY; }
  function pxToCmX(px: number): number { return (px - panX) / pxPerCm; }
  function pxToCmY(px: number): number { return (px - panY) / pxPerCm; }

  function onBackgroundPointerDown(e: React.PointerEvent) {
    if (!(e.target as HTMLElement).closest('[data-object]')) {
      (e.target as Element).setPointerCapture(e.pointerId);
      setIsPanning(true);
      setPanStart({ x: e.clientX - state.canvas.panX, y: e.clientY - state.canvas.panY });
      dispatch({ type: 'SELECT_OBJECT', id: null });
      dispatch({ type: 'SELECT_DOOR', id: null });
    }
  }
  function onBackgroundPointerMove(e: React.PointerEvent) {
    if (isPanning && panStart) {
      dispatch({ type: 'SET_CANVAS', panX: e.clientX - panStart.x, panY: e.clientY - panStart.y });
    }
  }
  function onBackgroundPointerUp(e: React.PointerEvent) {
    setIsPanning(false);
    setPanStart(null);
  }

  function startDragObject(obj: PlacedObject, e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragId(obj.id);
    setDragStart({ xCm: obj.xCm, yCm: obj.yCm, pointerX: e.clientX, pointerY: e.clientY });
    dispatch({ type: 'SELECT_OBJECT', id: obj.id });
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragId || !dragStart) return;
    const dxPx = e.clientX - dragStart.pointerX;
    const dyPx = e.clientY - dragStart.pointerY;
    const dxCm = dxPx / pxPerCm;
    const dyCm = dyPx / pxPerCm;
    const target = state.objects.find((o) => o.id === dragId);
    if (!target) return;
    let nx = dragStart.xCm + dxCm;
    let ny = dragStart.yCm + dyCm;
    if (snapCm > 0) {
      nx = snapToGridCm(nx, snapCm);
      ny = snapToGridCm(ny, snapCm);
    }
    // Constrain inside room
    const halfW = target.widthCm / 2;
    const halfD = target.depthCm / 2;
    nx = clamp(nx, halfW, roomW - halfW);
    ny = clamp(ny, halfD, roomD - halfD);
    dispatch({ type: 'UPDATE_OBJECT', id: dragId, updates: { xCm: nx, yCm: ny } });
  }
  function endDrag() {
    setDragId(null);
    setDragStart(null);
  }

  function rotateSelected(amount: number) {
    if (!selected) return;
    dispatch({ type: 'UPDATE_OBJECT', id: selected.id, updates: { rotationDeg: (selected.rotationDeg + amount + 360) % 360 } });
  }

  function drawGrid() {
    const elems: React.ReactNode[] = [];
    const stepPx = Math.max(8, snapCm * pxPerCm);
    const bounds = svgRef.current?.getBoundingClientRect();
    const w = bounds?.width ?? 0;
    const h = bounds?.height ?? 0;
    const startX = -((panX % stepPx) + stepPx) % stepPx;
    const startY = -((panY % stepPx) + stepPx) % stepPx;
    for (let x = startX; x < w; x += stepPx) {
      elems.push(<line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={h} stroke={'var(--grid)'} strokeWidth={1} />);
    }
    for (let y = startY; y < h; y += stepPx) {
      elems.push(<line key={`gy-${y}`} x1={0} y1={y} x2={w} y2={y} stroke={'var(--grid)'} strokeWidth={1} />);
    }
    return elems;
  }

  function renderDoors(doors: Door[]): React.ReactNode {
    return doors.map((d) => {
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      if (d.wall === 'north') {
        x1 = cmToPxX(d.offsetCm);
        y1 = cmToPxY(0);
        x2 = cmToPxX(d.offsetCm + d.widthCm);
        y2 = y1;
      } else if (d.wall === 'south') {
        x1 = cmToPxX(d.offsetCm);
        y1 = cmToPxY(roomD);
        x2 = cmToPxX(d.offsetCm + d.widthCm);
        y2 = y1;
      } else if (d.wall === 'west') {
        x1 = cmToPxX(0);
        y1 = cmToPxY(d.offsetCm);
        x2 = x1;
        y2 = cmToPxY(d.offsetCm + d.widthCm);
      } else {
        x1 = cmToPxX(roomW);
        y1 = cmToPxY(d.offsetCm);
        x2 = x1;
        y2 = cmToPxY(d.offsetCm + d.widthCm);
      }
      const isSel = state.selectedDoorId === d.id;
      return (
        <g key={d.id} onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); dispatch({ type: 'SELECT_DOOR', id: d.id }); dispatch({ type: 'SELECT_OBJECT', id: null }); }}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isSel ? 'var(--door-selected)' : 'var(--door)'}
            strokeWidth={Math.max(4, pxPerCm * 1.25)}
            strokeLinecap="round"
          />
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="transparent"
            strokeWidth={16}
          />
        </g>
      );
    });
  }

  function renderObject(o: PlacedObject): React.ReactNode {
    const x = cmToPxX(o.xCm);
    const y = cmToPxY(o.yCm);
    const w = o.widthCm * pxPerCm;
    const d = o.depthCm * pxPerCm;
    const transform = `translate(${x - w / 2}, ${y - d / 2}) rotate(${o.rotationDeg}, ${w / 2}, ${d / 2})`;
    const isSel = state.selectedObjectId === o.id;
    function getContrastText(hex: string): string {
      // Normalize hex
      let h = hex.trim().replace('#', '');
      if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
      }
      const num = parseInt(h, 16);
      if (Number.isNaN(num) || (h.length !== 6)) {
        return 'var(--label-text)';
      }
      const r = (num >> 16) & 0xff;
      const g = (num >> 8) & 0xff;
      const b = num & 0xff;
      // YIQ formula for contrast
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 186 ? '#000000' : '#ffffff';
    }
    const textOnObj = getContrastText(o.color);
    const nameTrim = o.name.trim();
    const isProExact = /^pro$/i.test(nameTrim);
    const isProAmExact = /^pro\s*am$/i.test(nameTrim);
    const isProAmName = /pro\s*am/i.test(nameTrim);
    const specialEdgeRatios = isProExact
      ? PRO_N_MONITOR_EDGE_RATIOS
      : isProAmExact
        ? PRO_AM_MONITOR_EDGE_RATIOS
        : null;
    const monitorEdgeLeftPx = specialEdgeRatios ? specialEdgeRatios.left * w : null;
    const monitorEdgeRightPx = specialEdgeRatios ? specialEdgeRatios.right * w : null;
    const dimLabel = `${Math.round(toDisplayUnitsVal(o.widthCm))}x${Math.round(toDisplayUnitsVal(o.depthCm))} ${unitsLabel}`;
    const textX = w / 2;
    return (
      <g key={o.id} data-object role="button" tabIndex={0} onPointerDown={(e) => startDragObject(o, e)} onPointerMove={onDragMove} onPointerUp={endDrag} onDoubleClick={() => dispatch({ type: 'SELECT_OBJECT', id: o.id })}>
        <g transform={transform} filter={isSel ? 'url(#objShadow)' : undefined}>
          {/* If simulator matches special outline, render SVG shape; otherwise draw rect. */}
          {(() => {
            if (o.kind === 'simulator' && isProExact) {
              return (
                <ProShape
                  widthPx={w}
                  heightPx={d}
                  fill={o.color}
                  stroke={isSel ? 'var(--object-stroke-selected)' : 'var(--object-stroke)'}
                  strokeWidth={1.25}
                  opacity={0.95}
                />
              );
            }
            if (o.kind === 'simulator' && isProAmExact) {
              return (
                <ProAmShape
                  widthPx={w}
                  heightPx={d}
                  fill={o.color}
                  stroke={isSel ? 'var(--object-stroke-selected)' : 'var(--object-stroke)'}
                  strokeWidth={1.25}
                  opacity={0.95}
                />
              );
            }
            return <rect width={w} height={d} rx={12} ry={12} fill={o.color} opacity={o.kind === 'simulator' ? 0.95 : 0.9} stroke={isSel ? 'var(--object-stroke-selected)' : 'var(--object-stroke)'} strokeWidth={isSel ? 2.5 : 1.25} />;
          })()}
          <text x={textX} y={d / 2 - 4} fontSize={14} fill={textOnObj} textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', fontWeight: 600, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            {o.name}
          </text>
          {state.showDimensions && (
            <text x={textX} y={d / 2 + 16} fontSize={12} fill={textOnObj} textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
              {dimLabel}
            </text>
          )}
          {/* Monitor attachment (renders in object-local coords so it rotates with the simulator) */}
          {o.kind === 'simulator' && o.monitor && o.monitor.layout !== 'none' && (() => {
            const isCurved = !!o.monitor.curvatureRadiusCm;
            const curvatureRadiusPx = isCurved ? o.monitor.curvatureRadiusCm! * pxPerCm : null;
            const mw = o.monitor.panelWidthCm * pxPerCm;
            const standDepthPx = o.monitor.panelDepthCm * pxPerCm;
            const baseMonitorThicknessCm = 3;
            const barThicknessPx = Math.max(2, baseMonitorThicknessCm * pxPerCm);
            const startX = (w - mw) / 2;
            // Special placements:
            //  - PRO AM: monitors sit on top with ~20cm of simulator protruding
            //  - PRO (exact): monitors sit on top with ~30cm buffer
            let chassisOffsetCm: number;
            if (isProExact) {
              chassisOffsetCm = -14;
            } else if (isProAmName) {
              const preset = o.monitor?.presetKey;
              let desiredSpecOffset: number;
              if (preset === 'single-49' || preset === 'triple-42' || preset === 'triple-45c') {
                desiredSpecOffset = -20;
              } else if (preset === 'triple-55' || preset === 'triple-65') {
                desiredSpecOffset = 14;
              } else {
                desiredSpecOffset = 30;
              }
              chassisOffsetCm = -desiredSpecOffset;
            } else {
              chassisOffsetCm = - (standDepthPx / pxPerCm) - (barThicknessPx / pxPerCm) - 6;
            }
            const desiredYOffsetPx = chassisOffsetCm * pxPerCm;
            const monitorFill = o.color;
            const monitorStroke = isSel ? 'var(--object-stroke-selected)' : 'var(--object-stroke)';
            const sagittaPx = (chord: number, radius: number) => radius - Math.sqrt(Math.max(0, radius ** 2 - (chord / 2) ** 2));
            const standBarThicknessPx = Math.max(2, 8 * pxPerCm);
            const standBarOffsetPx = 8 * pxPerCm;
            const standBarStrokeWidth = Math.max(0.8, 0.5 * pxPerCm);
            const standBarOverlapPx = Math.max(standBarThicknessPx, 12 * pxPerCm);
            const bulkWidthCm = 20;
            const bulkThicknessCm = 8;
            const renderStandBar = (x: number, width: number, baseY: number, extendLeft = 0, extendRight = 0, withBrackets: false | 'center' | 'left' | 'right' = false) => {
              const px = x - extendLeft;
              const barWidth = width + extendLeft + extendRight;
              const barY = baseY - standBarThicknessPx - standBarOffsetPx;
              return (
                <>
                  <rect
                    x={px}
                    y={barY}
                    width={barWidth}
                    height={standBarThicknessPx}
                    fill={o.color}
                    stroke={monitorStroke}
                    strokeWidth={standBarStrokeWidth}
                    opacity={0.9}
                  />
                  {withBrackets === 'center' && (
                    <>
                      <rect
                        x={px + 16 * pxPerCm}
                        y={barY - 8 * pxPerCm}
                        width={8 * pxPerCm}
                        height={8 * pxPerCm}
                        fill={monitorStroke}
                        opacity={0.45}
                        rx={Math.max(1, 0.4 * pxPerCm)}
                      />
                      <rect
                        x={px + barWidth - 16 * pxPerCm - 8 * pxPerCm}
                        y={barY - 8 * pxPerCm}
                        width={8 * pxPerCm}
                        height={8 * pxPerCm}
                        fill={monitorStroke}
                        opacity={0.45}
                        rx={Math.max(1, 0.4 * pxPerCm)}
                      />
                    </>
                  )}
                  {withBrackets === 'left' && (
                    <rect
                      x={px + 8 * pxPerCm}
                      y={barY - 8 * pxPerCm}
                      width={8 * pxPerCm}
                      height={8 * pxPerCm}
                      fill={monitorStroke}
                      opacity={0.45}
                      rx={Math.max(1, 0.4 * pxPerCm)}
                    />
                  )}
                  {withBrackets === 'right' && (
                    <rect
                      x={px + barWidth - 8 * pxPerCm - 8 * pxPerCm}
                      y={barY - 8 * pxPerCm}
                      width={8 * pxPerCm}
                      height={8 * pxPerCm}
                      fill={monitorStroke}
                      opacity={0.45}
                      rx={Math.max(1, 0.4 * pxPerCm)}
                    />
                  )}
                </>
              );
            };
            if (o.monitor.layout === 'single') {
              const singleSag = isCurved && curvatureRadiusPx ? sagittaPx(mw, curvatureRadiusPx) : 0;
              const startY = desiredYOffsetPx + singleSag;
              const measurementY = desiredYOffsetPx;
              const bulkWidthPx = Math.min(mw, bulkWidthCm * pxPerCm);
              const bulkThicknessPx = bulkThicknessCm * pxPerCm;
              const bulkX = startX + (mw - bulkWidthPx) / 2;
              const bulkY = measurementY - bulkThicknessPx;
              return (
                <g>
                  <rect x={bulkX} y={bulkY} width={bulkWidthPx} height={bulkThicknessPx} fill={monitorStroke} opacity={0.45} rx={Math.max(1, 0.5 * pxPerCm)} />
                  {renderStandBar(startX, mw, measurementY, 0, 0, 'center')}
                  {state.showDimensions && monitorEdgeLeftPx != null && monitorEdgeRightPx != null && (
                    <>
                      <line x1={monitorEdgeLeftPx} y1={0} x2={monitorEdgeLeftPx} y2={measurementY} stroke="rgba(0,0,0,0.35)" strokeDasharray="4 3" />
                      <line x1={monitorEdgeRightPx} y1={0} x2={monitorEdgeRightPx} y2={measurementY} stroke="rgba(0,0,0,0.35)" strokeDasharray="4 3" />
                      <text x={monitorEdgeLeftPx + 6} y={measurementY / 2} fontSize={10} fill="rgba(0,0,0,0.45)">
                        {`${Math.abs(chassisOffsetCm)} cm`}
                      </text>
                      <text x={monitorEdgeRightPx - 54} y={measurementY / 2} fontSize={10} fill="rgba(0,0,0,0.45)">
                        {`${Math.abs(chassisOffsetCm)} cm`}
                      </text>
                    </>
                  )}
                  {isCurved && curvatureRadiusPx ? (
                    <path
                      d={describeMonitorArc(startX, startY, mw, curvatureRadiusPx, true)}
                      stroke={monitorStroke}
                      strokeWidth={barThicknessPx}
                      fill="none"
                      strokeLinecap="round"
                      opacity={0.95}
                    />
                  ) : (
                    <rect x={startX} y={startY} width={mw} height={barThicknessPx} rx={Math.max(0.5, 0.8 * pxPerCm)} ry={Math.max(0.5, 0.8 * pxPerCm)} fill={monitorFill} opacity={0.95} stroke={monitorStroke} strokeWidth={0.8} />
                  )}
                  {state.showDimensions && (
                    <g>
                      <line x1={startX} y1={startY - 6} x2={startX + mw} y2={startY - 6} stroke={'var(--muted)'} strokeWidth={1} />
                      <text x={startX + mw / 2} y={startY - 8} fontSize={10} textAnchor="middle" fill={'var(--muted)'}>
                        {`${Math.round(toDisplayUnitsVal(o.monitor.panelWidthCm))} ${unitsLabel}`}
                      </text>
                    </g>
                  )}
                </g>
              );
            }
            // triple: draw 3 panels with gaps
            const gapPx = isCurved ? 0 : (o.monitor.gapCm ?? 0) * pxPerCm;
            const panelW = (mw - 2 * gapPx) / 3;
            const panelSag = isCurved && curvatureRadiusPx ? sagittaPx(panelW, curvatureRadiusPx) : 0;
            const panelStartY = desiredYOffsetPx + panelSag;
            const measurementY = desiredYOffsetPx;
            const angle = o.monitor.angleDeg ?? (isCurved ? (o.monitor.screenInches === 45 ? 68 : 90) : 20);
            const bulkThicknessPx = bulkThicknessCm * pxPerCm;
            const bulkWidthPxLimit = Math.min(panelW, bulkWidthCm * pxPerCm);
            const bulkY = measurementY - bulkThicknessPx;
            const renderBulk = (panelStartX: number) => (
              <rect
                x={panelStartX + (panelW - bulkWidthPxLimit) / 2}
                y={bulkY}
                width={bulkWidthPxLimit}
                height={bulkThicknessPx}
                fill={monitorStroke}
                opacity={0.45}
                rx={Math.max(1, 0.5 * pxPerCm)}
              />
            );
            return (
              <g>
                {state.showDimensions && monitorEdgeLeftPx != null && monitorEdgeRightPx != null && (
                  <>
                    <line x1={monitorEdgeLeftPx} y1={0} x2={monitorEdgeLeftPx} y2={measurementY} stroke="rgba(0,0,0,0.35)" strokeDasharray="4 3" />
                    <line x1={monitorEdgeRightPx} y1={0} x2={monitorEdgeRightPx} y2={measurementY} stroke="rgba(0,0,0,0.35)" strokeDasharray="4 3" />
                    <text x={monitorEdgeLeftPx + 6} y={measurementY / 2} fontSize={10} fill="rgba(0,0,0,0.45)">
                      {`${Math.abs(chassisOffsetCm)} cm`}
                    </text>
                    <text x={monitorEdgeRightPx - 54} y={measurementY / 2} fontSize={10} fill="rgba(0,0,0,0.45)">
                      {`${Math.abs(chassisOffsetCm)} cm`}
                    </text>
                  </>
                )}
                {/* Left panel rotated inward */}
                <g transform={`rotate(${-angle}, ${startX + panelW}, ${panelStartY + barThicknessPx / 2})`}>
                  {renderBulk(startX)}
                  {renderStandBar(startX + panelW * 0.35, panelW * 0.65, measurementY, 0, standBarOverlapPx * 0.65, 'left')}
                  {isCurved && curvatureRadiusPx ? (
                    <path
                      d={describeMonitorArc(startX, panelStartY, panelW, curvatureRadiusPx, true)}
                      stroke={monitorStroke}
                      strokeWidth={barThicknessPx}
                      fill="none"
                      strokeLinecap="round"
                      opacity={0.95}
                    />
                  ) : (
                  <rect x={startX} y={panelStartY} width={panelW} height={barThicknessPx} rx={Math.max(0.5, 0.8 * pxPerCm)} ry={Math.max(0.5, 0.8 * pxPerCm)} fill={monitorFill} opacity={0.95} stroke={monitorStroke} strokeWidth={0.8} />
                  )}
                </g>
                {/* Center panel */}
                {renderBulk(startX + panelW + gapPx)}
                {renderStandBar(startX + panelW + gapPx, panelW, measurementY, standBarOverlapPx, standBarOverlapPx, 'center')}
                {isCurved && curvatureRadiusPx ? (
                  <path
                    d={describeMonitorArc(startX + panelW + gapPx, panelStartY, panelW, curvatureRadiusPx, true)}
                    stroke={monitorStroke}
                    strokeWidth={barThicknessPx}
                    fill="none"
                    strokeLinecap="round"
                    opacity={0.98}
                  />
                ) : (
                  <rect x={startX + panelW + gapPx} y={panelStartY} width={panelW} height={barThicknessPx} rx={Math.max(0.5, 0.8 * pxPerCm)} ry={Math.max(0.5, 0.8 * pxPerCm)} fill={monitorFill} opacity={0.98} stroke={monitorStroke} strokeWidth={0.8} />
                )}
                {/* Right panel rotated inward */}
                <g transform={`rotate(${angle}, ${startX + 2 * (panelW + gapPx)}, ${panelStartY + barThicknessPx / 2})`}>
                  {renderBulk(startX + 2 * (panelW + gapPx))}
                  {renderStandBar(startX + 2 * (panelW + gapPx), panelW * 0.65, measurementY, standBarOverlapPx * 0.65, 0, 'right')}
                  {isCurved && curvatureRadiusPx ? (
                    <path
                      d={describeMonitorArc(startX + 2 * (panelW + gapPx), panelStartY, panelW, curvatureRadiusPx, true)}
                      stroke={monitorStroke}
                      strokeWidth={barThicknessPx}
                      fill="none"
                      strokeLinecap="round"
                      opacity={0.95}
                    />
                  ) : (
                  <rect x={startX + 2 * (panelW + gapPx)} y={panelStartY} width={panelW} height={barThicknessPx} rx={Math.max(0.5, 0.8 * pxPerCm)} ry={Math.max(0.5, 0.8 * pxPerCm)} fill={monitorFill} opacity={0.95} stroke={monitorStroke} strokeWidth={0.8} />
                  )}
                </g>
                {state.showDimensions && (
                  <g>
                    {(() => {
                      // Compute rotated outer endpoints of side panels and measure between them
                      const cy = panelStartY + barThicknessPx / 2;
                      // Left outer midpoint before rotation
                      const l0x = startX; const l0y = cy;
                      const lcx = startX + panelW; const lcy = cy; // left pivot (inner edge)
                      const rad = (angle * Math.PI) / 180;
                      const cos = Math.cos(-rad), sin = Math.sin(-rad);
                      const ldx = l0x - lcx, ldy = l0y - lcy;
                      const lx = lcx + (ldx * cos - ldy * sin);
                      const ly = lcy + (ldx * sin + ldy * cos);

                      // Right outer midpoint before rotation
                      const rInnerX = startX + 2 * (panelW + gapPx);
                      const r0x = rInnerX + panelW; const r0y = cy;
                      const rcx = rInnerX; const rcy = cy; // right pivot (inner edge)
                      const cosR = Math.cos(rad), sinR = Math.sin(rad);
                      const rdx = r0x - rcx, rdy = r0y - rcy;
                      const rx = rcx + (rdx * cosR - rdy * sinR);
                      const ry = rcy + (rdx * sinR + rdy * cosR);

                      const spanPx = Math.hypot(rx - lx, ry - ly);
                      const spanCm = spanPx / pxPerCm;
                      const mx = (lx + rx) / 2; const my = (ly + ry) / 2;

                      return (
                        <g>
                          <line x1={lx} y1={ly - 6} x2={rx} y2={ry - 6} stroke={'var(--muted)'} strokeWidth={1} />
                          <text x={mx} y={my - 8} fontSize={10} textAnchor="middle" fill={'var(--muted)'}>
                            {`${Math.round(toDisplayUnitsVal(spanCm))} ${unitsLabel}`}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
              </g>
            );
          })()}
        </g>
        {state.showDimensions && (() => {
          // Compute rotated rectangle corners in cm
          const angle = (o.rotationDeg || 0) * Math.PI / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const hw = o.widthCm / 2;
          const hd = o.depthCm / 2;
          const localCorners: Array<[number, number]> = [
            [-hw, -hd],
            [ hw, -hd],
            [ hw,  hd],
            [-hw,  hd],
          ];
          const worldCorners = localCorners.map(([dx, dy]) => {
            const x = o.xCm + dx * cos - dy * sin;
            const y = o.yCm + dx * sin + dy * cos;
            return { x, y };
          });

          let minX = Infinity, maxX = -Infinity, yAtMinX = o.yCm, yAtMaxX = o.yCm;
          let minY = Infinity, maxY = -Infinity, xAtMinY = o.xCm, xAtMaxY = o.xCm;
          for (const c of worldCorners) {
            if (c.x < minX) { minX = c.x; yAtMinX = c.y; }
            if (c.x > maxX) { maxX = c.x; yAtMaxX = c.y; }
            if (c.y < minY) { minY = c.y; xAtMinY = c.x; }
            if (c.y > maxY) { maxY = c.y; xAtMaxY = c.x; }
          }

          const distLeft = Math.max(0, minX - 0);
          const distRight = Math.max(0, roomW - maxX);
          const distTop = Math.max(0, minY - 0);
          const distBottom = Math.max(0, roomD - maxY);

          const stroke = 'var(--muted)';
          const fontSize = 10;
          return (
            <g>
              {/* Left distance from closest point */}
              <line x1={cmToPxX(0)} y1={cmToPxY(yAtMinX)} x2={cmToPxX(minX)} y2={cmToPxY(yAtMinX)} stroke={stroke} strokeDasharray="4 3" strokeWidth={1} />
              <text x={(cmToPxX(0) + cmToPxX(minX)) / 2} y={cmToPxY(yAtMinX) - 4} fontSize={fontSize} textAnchor="middle" fill={stroke}>
                {`${Math.round(toDisplayUnitsVal(distLeft))} ${unitsLabel}`}
              </text>
              {/* Right distance from closest point */}
              <line x1={cmToPxX(maxX)} y1={cmToPxY(yAtMaxX)} x2={cmToPxX(roomW)} y2={cmToPxY(yAtMaxX)} stroke={stroke} strokeDasharray="4 3" strokeWidth={1} />
              <text x={(cmToPxX(maxX) + cmToPxX(roomW)) / 2} y={cmToPxY(yAtMaxX) - 4} fontSize={fontSize} textAnchor="middle" fill={stroke}>
                {`${Math.round(toDisplayUnitsVal(distRight))} ${unitsLabel}`}
              </text>
              {/* Top distance from closest point */}
              <line x1={cmToPxX(xAtMinY)} y1={cmToPxY(0)} x2={cmToPxX(xAtMinY)} y2={cmToPxY(minY)} stroke={stroke} strokeDasharray="4 3" strokeWidth={1} />
              <text x={cmToPxX(xAtMinY) + 6} y={(cmToPxY(0) + cmToPxY(minY)) / 2} fontSize={fontSize} fill={stroke}>
                {`${Math.round(toDisplayUnitsVal(distTop))} ${unitsLabel}`}
              </text>
              {/* Bottom distance from closest point */}
              <line x1={cmToPxX(xAtMaxY)} y1={cmToPxY(maxY)} x2={cmToPxX(xAtMaxY)} y2={cmToPxY(roomD)} stroke={stroke} strokeDasharray="4 3" strokeWidth={1} />
              <text x={cmToPxX(xAtMaxY) + 6} y={(cmToPxY(maxY) + cmToPxY(roomD)) / 2} fontSize={fontSize} fill={stroke}>
                {`${Math.round(toDisplayUnitsVal(distBottom))} ${unitsLabel}`}
              </text>
            </g>
          );
        })()}
      </g>
    );
  }

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={(e) => { onBackgroundPointerMove(e); onDragMove(e); }}
      onPointerUp={(e) => { onBackgroundPointerUp(e); endDrag(); }}
      style={{ touchAction: 'none', userSelect: 'none' }}
      aria-label="Room canvas"
    >
      <defs>
        <filter id="objShadow" x="-20%" y="-20%" width="140%" height="140%">
          {/* Use current theme accent for shadow */}
          <feFlood flood-color="var(--accent)" flood-opacity="0.35" result="f" />
          <feComposite in="f" in2="SourceAlpha" operator="in" result="shadow" />
          <feOffset dx="0" dy="2" in="shadow" result="o" />
          <feGaussianBlur stdDeviation="2" in="o" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Grid */}
      <g>{drawGrid()}</g>

      {/* Room */}
      <rect
        x={cmToPxX(0)}
        y={cmToPxY(0)}
        width={roomW * pxPerCm}
        height={roomD * pxPerCm}
        fill={'var(--room-fill)'}
        stroke={'var(--room-stroke)'}
        strokeWidth={2}
      />
      {state.showDimensions && (
        <g>
          <text x={cmToPxX(roomW / 2)} y={cmToPxY(0) + 12} fontSize={11} textAnchor="middle" fill={'var(--muted)'}>
            {`${Math.round(toDisplayUnitsVal(roomW))} ${unitsLabel}`}
          </text>
          <text x={cmToPxX(0) + 6} y={cmToPxY(roomD / 2)} fontSize={11} fill={'var(--muted)'}>
            {`${Math.round(toDisplayUnitsVal(roomD))} ${unitsLabel}`}
          </text>
        </g>
      )}

      {/* Doors */}
      <g>{renderDoors(state.doors)}</g>

      {/* Objects */}
      <g>
        {state.objects.map(renderObject)}
      </g>

      {/* Overlay removed; rotation moved to top bar */}

      <foreignObject x={0} y={0} width="100%" height="100%" className="canvas-overlay">
        <div className="legend">
          <div>Drag background to pan</div>
          <div>Drag object to move, double click to select</div>
        </div>
      </foreignObject>
    </svg>
  );
};



