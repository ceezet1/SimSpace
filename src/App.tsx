import React, { useEffect, useMemo, useReducer } from 'react';
import { loadState, saveState } from './utils/persistence';
import { ProjectState, PlacedObject } from './types';
import { Controls } from './components/Controls';
import { RoomCanvas } from './components/RoomCanvas';

type Action =
  | { type: 'SET_UNITS'; units: ProjectState['units'] }
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

  const selected = useMemo(() => state.objects.find((o) => o.id === state.selectedObjectId) ?? null, [state.objects, state.selectedObjectId]);

  return (
    <div className="app">
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong>Room Simulator Planner</strong>
          <span className="badge">Top-down 2D</span>
        </div>
        <div className="toolbar" aria-label="Canvas tools">
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



