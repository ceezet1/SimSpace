import React, { useMemo, useRef, useState } from 'react';
import { Door, PlacedObject, ProjectState, Wall } from '../types';

interface ControlsProps {
  state: ProjectState;
  dispatch: React.Dispatch<any>;
}

function toDisplayUnits(cm: number, units: ProjectState['units']): number {
  return units === 'metric' ? cm : cm / 2.54; // inches
}

function fromDisplayUnits(val: number, units: ProjectState['units']): number {
  return units === 'metric' ? val : val * 2.54;
}

function fmtUnit(units: ProjectState['units']): string {
  return units === 'metric' ? 'cm' : 'in';
}

export const Controls: React.FC<ControlsProps> = ({ state, dispatch }) => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [objName, setObjName] = useState('Desk');
  const [objW, setObjW] = useState(120);
  const [objD, setObjD] = useState(60);
  const [objColor, setObjColor] = useState('#E8B298');

  const [doorWall, setDoorWall] = useState<Wall>('north');
  const [doorOffset, setDoorOffset] = useState(0);
  const [doorWidth, setDoorWidth] = useState(80);

  const roomWDisplay = useMemo(() => toDisplayUnits(state.room.widthCm, state.units), [state.room.widthCm, state.units]);
  const roomDDisplay = useMemo(() => toDisplayUnits(state.room.depthCm, state.units), [state.room.depthCm, state.units]);
  const simWDisplay = useMemo(() => toDisplayUnits(state.simulator.widthCm, state.units), [state.simulator.widthCm, state.units]);
  const simDDisplay = useMemo(() => toDisplayUnits(state.simulator.depthCm, state.units), [state.simulator.depthCm, state.units]);

  function updateRoom(w: number, d: number) {
    dispatch({ type: 'SET_ROOM', widthCm: fromDisplayUnits(w, state.units), depthCm: fromDisplayUnits(d, state.units) });
  }
  function updateSim(w: number, d: number) {
    dispatch({ type: 'SET_SIMULATOR', widthCm: fromDisplayUnits(w, state.units), depthCm: fromDisplayUnits(d, state.units) });
  }

  function addObject() {
    const widthCm = fromDisplayUnits(objW, state.units);
    const depthCm = fromDisplayUnits(objD, state.units);
    const object: PlacedObject = {
      id: `obj_${Date.now()}`,
      name: objName || 'Object',
      widthCm,
      depthCm,
      xCm: state.room.widthCm / 2,
      yCm: state.room.depthCm / 2,
      rotationDeg: 0,
      color: objColor,
      kind: 'furniture',
    };
    dispatch({ type: 'ADD_OBJECT', object });
  }

  function addDoor() {
    const door: Door = {
      id: `door_${Date.now()}`,
      wall: doorWall,
      offsetCm: fromDisplayUnits(doorOffset, state.units),
      widthCm: fromDisplayUnits(doorWidth, state.units),
    };
    dispatch({ type: 'SET_DOORS', doors: [...state.doors, door] });
  }

  function deleteDoor(id: string) {
    dispatch({ type: 'SET_DOORS', doors: state.doors.filter((d) => d.id !== id) });
  }

  return (
    <div>
      <div className="section">
        <h3>Project</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="units">Units</label>
            <select
              id="units"
              value={state.units}
              onChange={(e) => dispatch({ type: 'SET_UNITS', units: e.target.value })}
            >
              <option value="metric">Metric (cm)</option>
              <option value="imperial">Imperial (in)</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Grid size</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={1}
                value={state.units === 'metric' ? state.canvas.snapCm : state.canvas.snapCm / 2.54}
                onChange={(e) =>
                  dispatch({ type: 'SET_CANVAS', snapCm: fromDisplayUnits(Number(e.target.value || 0), state.units) })
                }
              />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="section">
        <h3>Project Data</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="ghost"
            onClick={() => {
              const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'room-sim-project.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              try {
                const data = JSON.parse(text);
                dispatch({ type: 'LOAD', state: data });
              } catch (err) {
                alert('Invalid JSON file');
              }
              if (importInputRef.current) importInputRef.current.value = '';
            }}
          />
          <button className="ghost" onClick={() => importInputRef.current?.click()}>Import</button>
        </div>
      </div>

      <div className="section">
        <h3>Room</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="room-w">Width</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="room-w"
                type="number"
                min={10}
                value={Math.round(roomWDisplay)}
                onChange={(e) => updateRoom(Number(e.target.value || 0), roomDDisplay)}
              />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="room-d">Depth</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="room-d"
                type="number"
                min={10}
                value={Math.round(roomDDisplay)}
                onChange={(e) => updateRoom(roomWDisplay, Number(e.target.value || 0))}
              />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Simulator</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="sim-w">Width</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="sim-w"
                type="number"
                min={10}
                value={Math.round(simWDisplay)}
                onChange={(e) => updateSim(Number(e.target.value || 0), simDDisplay)}
              />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="sim-d">Depth</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="sim-d"
                type="number"
                min={10}
                value={Math.round(simDDisplay)}
                onChange={(e) => updateSim(simWDisplay, Number(e.target.value || 0))}
              />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Add Object</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="obj-name">Name</label>
            <input id="obj-name" value={objName} onChange={(e) => setObjName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="obj-color">Color</label>
            <input id="obj-color" type="color" value={objColor} onChange={(e) => setObjColor(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="obj-w">Width</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="obj-w" type="number" min={1} value={objW} onChange={(e) => setObjW(Number(e.target.value || 0))} />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="obj-d">Depth</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="obj-d" type="number" min={1} value={objD} onChange={(e) => setObjD(Number(e.target.value || 0))} />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="primary" onClick={addObject}>Add</button>
        </div>
      </div>

      <div className="section">
        <h3>Doors</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="door-wall">Wall</label>
            <select id="door-wall" value={doorWall} onChange={(e) => setDoorWall(e.target.value as Wall)}>
              <option value="north">North (top)</option>
              <option value="south">South (bottom)</option>
              <option value="east">East (right)</option>
              <option value="west">West (left)</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="door-width">Door width</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="door-width" type="number" min={1} value={doorWidth} onChange={(e) => setDoorWidth(Number(e.target.value || 0))} />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="door-offset">Offset from corner</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="door-offset" type="number" min={0} value={doorOffset} onChange={(e) => setDoorOffset(Number(e.target.value || 0))} />
              <span className="badge">{fmtUnit(state.units)}</span>
            </div>
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button onClick={addDoor}>Add door</button>
          </div>
        </div>

        <div className="list" style={{ marginTop: 10 }}>
          {state.doors.length === 0 && <span className="label">No doors</span>}
          {state.doors.map((d) => (
            <div key={d.id} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge">{d.wall}</span>
                <span>{Math.round(toDisplayUnits(d.widthCm, state.units))}{fmtUnit(state.units)}</span>
                <span className="label">at</span>
                <span>{Math.round(toDisplayUnits(d.offsetCm, state.units))}{fmtUnit(state.units)}</span>
              </div>
              <button className="danger" onClick={() => deleteDoor(d.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Objects & Doors</h3>
        <div className="list">
          {state.objects.map((o) => (
            <div key={o.id} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge" style={{ background: o.color, color: '#0b0d12', borderColor: '#24314d' }}>●</span>
                <strong>{o.name}</strong>
                <span className="label">{Math.round(o.widthCm)}x{Math.round(o.depthCm)} cm</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => dispatch({ type: 'SELECT_OBJECT', id: o.id })}>Select</button>
                <button className="danger" disabled={o.kind === 'simulator'} onClick={() => dispatch({ type: 'DELETE_OBJECT', id: o.id })}>Delete</button>
              </div>
            </div>
          ))}
          {state.doors.map((d) => (
            <div key={d.id} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge">Door</span>
                <strong>{d.wall}</strong>
                <span className="label">{Math.round(d.widthCm)} cm</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => dispatch({ type: 'SELECT_DOOR', id: d.id })}>Select</button>
                <button className="danger" onClick={() => dispatch({ type: 'SET_DOORS', doors: state.doors.filter((x) => x.id !== d.id) })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {state.selectedObjectId && (
        <div className="section">
          <h3>Selected Object</h3>
          <div className="row">
            <div className="field" style={{ gridColumn: '1 / span 2' }}>
              <label className="label">Rotation</label>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={state.objects.find(o => o.id === state.selectedObjectId)?.rotationDeg ?? 0}
                onChange={(e) => state.selectedObjectId && dispatch({ type: 'UPDATE_OBJECT', id: state.selectedObjectId, updates: { rotationDeg: Number(e.target.value) } })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


