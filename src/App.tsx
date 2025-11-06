import React, { useEffect, useMemo, useReducer } from 'react';
import { loadState, saveState } from './utils/persistence';
import { ProjectState, PlacedObject, ThemeName } from './types';
import { Controls } from './components/Controls';
import { RoomCanvas } from './components/RoomCanvas';
import Logo from './assets/dome-logoblack.svg';
import { getMonitorAttachment, MonitorKey } from './utils/monitors';
import { getPalette } from './utils/theme';

type Action =
  | { type: 'SET_UNITS'; units: ProjectState['units'] }
  | { type: 'SET_THEME'; theme: ThemeName }
  | { type: 'SET_ROOM'; widthCm: number; depthCm: number }
  | { type: 'SET_SIMULATOR'; widthCm: number; depthCm: number }
  | { type: 'SET_CANVAS'; pxPerCm?: number; panX?: number; panY?: number; snapCm?: number }
  | { type: 'ADD_OBJECT'; object: PlacedObject }
  | { type: 'UPDATE_OBJECT'; id: string; updates: Partial<PlacedObject> }
  | { type: 'DELETE_OBJECT'; id: string }
  | { type: 'SELECT_OBJECT'; id: string | null }
  | { type: 'SELECT_DOOR'; id: string | null }
  | { type: 'SET_DOORS'; doors: ProjectState['doors'] }
  | { type: 'LOAD'; state: ProjectState };

const DEFAULT_STATE: ProjectState = {
  units: 'metric',
  theme: 'soft',
  room: { widthCm: 400, depthCm: 300 },
  simulator: { widthCm: 160, depthCm: 60 },
  doors: [],
  objects: [],
  selectedObjectId: null,
  selectedDoorId: null,
  canvas: { pxPerCm: 1.5, panX: 0, panY: 0, snapCm: 5 },
};

function ensureSimulatorObject(objects: PlacedObject[], sim: ProjectState['simulator'], room: ProjectState['room']): PlacedObject[] {
  const existing = objects.find((o) => o.kind === 'simulator');
  if (!existing) {
    return [
      ...objects,
      {
        id: 'simulator',
        name: 'Racing Simulator',
        widthCm: sim.widthCm,
        depthCm: sim.depthCm,
        xCm: room.widthCm / 2,
        yCm: room.depthCm / 2,
        rotationDeg: 0,
        color: '#9EABA2',
        kind: 'simulator',
      },
    ];
  }
  if (existing.widthCm !== sim.widthCm || existing.depthCm !== sim.depthCm) {
    return objects.map((o) => (o.id === existing.id ? { ...o, widthCm: sim.widthCm, depthCm: sim.depthCm } : o));
  }
  return objects;
}

function reducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'LOAD':
      return { ...action.state };
    case 'SET_UNITS':
      return { ...state, units: action.units };
    case 'SET_THEME':
      // Update theme and re-apply colors for objects that follow theme palette via themeColorIndex
      {
        const palette = getPalette(action.theme);
        const objects = state.objects.map((o) =>
          o.themeColorIndex !== undefined
            ? { ...o, color: palette[Math.max(0, Math.min(palette.length - 1, o.themeColorIndex))] || o.color }
            : o
        );
        return { ...state, theme: action.theme, objects };
      }
    case 'SET_ROOM': {
      const room = { widthCm: action.widthCm, depthCm: action.depthCm };
      return { ...state, room };
    }
    case 'SET_SIMULATOR': {
      const simulator = { widthCm: action.widthCm, depthCm: action.depthCm };
      const objects = ensureSimulatorObject(state.objects, simulator, state.room);
      return { ...state, simulator, objects };
    }
    case 'SET_CANVAS':
      return {
        ...state,
        canvas: {
          pxPerCm: action.pxPerCm ?? state.canvas.pxPerCm,
          panX: action.panX ?? state.canvas.panX,
          panY: action.panY ?? state.canvas.panY,
          snapCm: action.snapCm ?? state.canvas.snapCm,
        },
      };
    case 'ADD_OBJECT':
      return { ...state, objects: [...state.objects, action.object], selectedObjectId: action.object.id };
    case 'UPDATE_OBJECT':
      return {
        ...state,
        objects: state.objects.map((o) => (o.id === action.id ? { ...o, ...action.updates } : o)),
      };
    case 'DELETE_OBJECT':
      return {
        ...state,
        objects: state.objects.filter((o) => o.id !== action.id),
        selectedObjectId: state.selectedObjectId === action.id ? null : state.selectedObjectId,
      };
    case 'SELECT_OBJECT':
      return { ...state, selectedObjectId: action.id };
    case 'SELECT_DOOR':
      return { ...state, selectedDoorId: action.id };
    case 'SET_DOORS':
      return { ...state, doors: action.doors };
    default:
      return state;
  }
}

export default function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // Load saved project once
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      dispatch({ type: 'LOAD', state: saved });
    } else {
      // ensure simulator object exists on first load
      dispatch({ type: 'SET_SIMULATOR', widthCm: DEFAULT_STATE.simulator.widthCm, depthCm: DEFAULT_STATE.simulator.depthCm });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Apply theme to document body
  useEffect(() => {
    if (state.theme) {
      document.body.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);

  const selected = useMemo(() => state.objects.find((o) => o.id === state.selectedObjectId) ?? null, [state.objects, state.selectedObjectId]);

  return (
    <div className="app">
      <div className="topbar">
        {/* Left: brand */}
        <div className="brand">
          <div className="brand-logo" aria-hidden="true" />
          <strong className="brand-name">SimSpace</strong>
        </div>
        <div className="v-sep" />
        {/* Middle: object controls (monitor/display + angle), rotate at far right */}
        <div className="topbar-middle" aria-label="Object controls">
          {selected && selected.kind === 'simulator' && (
            <>
              <label className="label" htmlFor="sim-monitor">Displays</label>
              <select
                id="sim-monitor"
                value={(selected.monitor && selected.monitor.layout !== 'none') ? (`${selected.monitor.layout}-${selected.monitor.screenInches ?? 49}` as MonitorKey) : 'none'}
                onChange={(e) => {
                  const key = e.target.value as MonitorKey;
                  const attach = getMonitorAttachment(key);
                  dispatch({ type: 'UPDATE_OBJECT', id: selected.id, updates: { monitor: attach } });
                }}
              >
                <option value="none">None</option>
                <option value="single-49">Single 49"</option>
                <option value="triple-42">Triple 42"</option>
                <option value="triple-45c">Triple 45" curved</option>
                <option value="triple-55">Triple 55"</option>
                <option value="triple-65">Triple 65"</option>
              </select>
              {selected.monitor && selected.monitor.layout === 'triple' && (
                <>
                  <label className="label" htmlFor="sim-angle">Display angle</label>
                  <input
                    id="sim-angle"
                    type="range"
                    min={45}
                    max={80}
                    step={1}
                    value={selected.monitor.angleDeg ?? 60}
                    onChange={(e) => dispatch({ type: 'UPDATE_OBJECT', id: selected.id, updates: { monitor: { ...selected.monitor!, angleDeg: Number(e.target.value) } } })}
                  />
                  <input
                    id="sim-angle-input"
                    type="number"
                    min={45}
                    max={80}
                    step={1}
                    value={selected.monitor.angleDeg ?? 60}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const clamped = Math.max(45, Math.min(80, isNaN(raw) ? 60 : raw));
                      dispatch({ type: 'UPDATE_OBJECT', id: selected.id, updates: { monitor: { ...selected.monitor!, angleDeg: clamped } } });
                    }}
                    aria-label="Angle degrees"
                    style={{ width: 64, marginLeft: 8 }}
                  />
                  <span className="badge">°</span>
                </>
              )}
            </>
          )}
          <div className="flex-spacer" />
          {selected && (
            <>
              <label className="label" htmlFor="rotate">Rotate</label>
              <input
                id="rotate"
                type="range"
                min={0}
                max={359}
                step={1}
                value={selected.rotationDeg}
                onChange={(e) => dispatch({ type: 'UPDATE_OBJECT', id: selected.id, updates: { rotationDeg: Number(e.target.value) } })}
              />
            </>
          )}
        </div>
        <div className="v-sep" />
        {/* Right: zoom and grid */}
        <div className="topbar-right" aria-label="Canvas tools">
          <label className="label" htmlFor="zoom">Zoom</label>
          <input
            id="zoom"
            type="range"
            min={0.5}
            max={4}
            step={0.1}
            value={state.canvas.pxPerCm}
            onChange={(e) => dispatch({ type: 'SET_CANVAS', pxPerCm: Number(e.target.value) })}
          />
          <label className="label" htmlFor="snap">Grid</label>
          <input
            id="snap"
            type="range"
            min={1}
            max={50}
            step={1}
            value={state.canvas.snapCm}
            onChange={(e) => dispatch({ type: 'SET_CANVAS', snapCm: Number(e.target.value) })}
          />
        </div>
      </div>
      <aside className="sidebar" aria-label="Controls">
        <Controls state={state} dispatch={dispatch} />
      </aside>
      <main className="canvas" aria-label="Canvas">
        <RoomCanvas state={state} dispatch={dispatch} selected={selected} />
      </main>
    </div>
  );
}



