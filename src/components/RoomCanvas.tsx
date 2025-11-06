import React, { useMemo, useRef, useState } from 'react';
import { ProjectState, PlacedObject, Door } from '../types';
import { clamp, snapToGridCm } from '../utils/geometry';

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
    return (
      <g key={o.id} data-object role="button" tabIndex={0} onPointerDown={(e) => startDragObject(o, e)} onPointerMove={onDragMove} onPointerUp={endDrag} onDoubleClick={() => dispatch({ type: 'SELECT_OBJECT', id: o.id })}>
        <g transform={transform} filter={isSel ? 'url(#objShadow)' : undefined}>
          <rect width={w} height={d} rx={12} ry={12} fill={o.color} opacity={o.kind === 'simulator' ? 0.95 : 0.9} stroke={isSel ? 'var(--object-stroke-selected)' : 'var(--object-stroke)'} strokeWidth={isSel ? 2.5 : 1.25} />
          <text x={10} y={20} fontSize={12} fill={'var(--label-text)'} style={{ userSelect: 'none', fontWeight: 600 }}>{o.name}</text>
          {/* Monitor attachment (renders in object-local coords so it rotates with the simulator) */}
          {o.kind === 'simulator' && o.monitor && o.monitor.layout !== 'none' && (() => {
            const mw = o.monitor.panelWidthCm * pxPerCm;
            const standDepthPx = o.monitor.panelDepthCm * pxPerCm;
            const barThicknessPx = 8 * pxPerCm; // visual thickness of monitor in top-down view (~8cm)
            const startX = (w - mw) / 2;
            // Special placements:
            //  - PRO AM: monitors sit on top with ~20cm of simulator protruding
            //  - PRO (exact): monitors sit on top with ~30cm buffer
            const nameTrim = o.name.trim();
            const isProAm = /pro\s*am/i.test(nameTrim);
            const isProExact = /^pro$/i.test(nameTrim);
            const startY = isProAm
              ? 20 * pxPerCm
              : isProExact
                ? 30 * pxPerCm
                : (-standDepthPx - barThicknessPx - 6);
            const monitorFill = o.color;
            const monitorStroke = isSel ? 'var(--object-stroke-selected)' : 'var(--object-stroke)';
            if (o.monitor.layout === 'single') {
              return <rect x={startX} y={startY} width={mw} height={barThicknessPx} rx={6} ry={6} fill={monitorFill} opacity={0.9} stroke={monitorStroke} strokeWidth={1} />;
            }
            // triple: draw 3 panels with gaps
            const gapPx = (o.monitor.gapCm ?? 2) * pxPerCm;
            const panelW = (mw - 2 * gapPx) / 3;
            const angle = o.monitor.angleDeg ?? 20;
            return (
              <g>
                {/* Left panel rotated inward */}
                <g transform={`rotate(${-angle}, ${startX + panelW}, ${startY + barThicknessPx / 2})`}>
                  <rect x={startX} y={startY} width={panelW} height={barThicknessPx} rx={6} ry={6} fill={monitorFill} opacity={0.9} stroke={monitorStroke} strokeWidth={1} />
                </g>
                {/* Center panel */}
                <rect x={startX + panelW + gapPx} y={startY} width={panelW} height={barThicknessPx} rx={6} ry={6} fill={monitorFill} opacity={0.95} stroke={monitorStroke} strokeWidth={1} />
                {/* Right panel rotated inward */}
                <g transform={`rotate(${angle}, ${startX + 2 * (panelW + gapPx)}, ${startY + barThicknessPx / 2})`}>
                  <rect x={startX + 2 * (panelW + gapPx)} y={startY} width={panelW} height={barThicknessPx} rx={6} ry={6} fill={monitorFill} opacity={0.9} stroke={monitorStroke} strokeWidth={1} />
                </g>
              </g>
            );
          })()}
        </g>
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



