import React, { useMemo, useRef, useState } from 'react';
import { Door, PlacedObject, ProjectState, Wall } from '../types';
import { getMonitorAttachment, MonitorKey } from '../utils/monitors';
import { getPalette } from '../utils/theme';

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
  const currentPalette = getPalette(state.theme);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [objName, setObjName] = useState('Desk');
  const [objW, setObjW] = useState(120);
  const [objD, setObjD] = useState(60);
  const [objColorIndex, setObjColorIndex] = useState(2);
  const objColor = currentPalette[Math.max(0, Math.min(currentPalette.length - 1, objColorIndex))] || currentPalette[0];
  const [tplMonitor, setTplMonitor] = useState<MonitorKey>('none');

  const [doorWall, setDoorWall] = useState<Wall>('north');
  const [doorOffset, setDoorOffset] = useState(0);
  const [doorWidth, setDoorWidth] = useState(80);

  const roomWDisplay = useMemo(() => toDisplayUnits(state.room.widthCm, state.units), [state.room.widthCm, state.units]);
  const roomDDisplay = useMemo(() => toDisplayUnits(state.room.depthCm, state.units), [state.room.depthCm, state.units]);

  function updateRoom(w: number, d: number) {
    dispatch({ type: 'SET_ROOM', widthCm: fromDisplayUnits(w, state.units), depthCm: fromDisplayUnits(d, state.units) });
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
      themeColorIndex: objColorIndex,
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

  function addTemplate(name: string, widthCm: number, depthCm: number, color: string) {
    const object: PlacedObject = {
      id: `tpl_${name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
      name,
      widthCm,
      depthCm,
      xCm: state.room.widthCm / 2,
      yCm: state.room.depthCm / 2,
      rotationDeg: 0,
      color,
      kind: 'simulator',
      monitor: getMonitorAttachment(tplMonitor),
      themeColorIndex: currentPalette.indexOf(color) >= 0 ? currentPalette.indexOf(color) : undefined,
    };
    dispatch({ type: 'ADD_OBJECT', object });
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
            <label className="label" htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={state.theme || 'soft'}
              onChange={(e) => dispatch({ type: 'SET_THEME', theme: e.target.value })}
            >
              <option value="default">Default</option>
              <option value="soft">Soft</option>
              <option value="vibrant">Vibrant</option>
              <option value="slate">Slate</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <label className="label" htmlFor="grid-snap">Grid</label>
          <input
            id="grid-snap"
            type="range"
            min={1}
            max={50}
            step={1}
            value={state.canvas.snapCm}
            onChange={(e) => dispatch({ type: 'SET_CANVAS', snapCm: Number(e.target.value) })}
          />
          <span className="badge">{state.canvas.snapCm} cm</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            className="ghost"
            onClick={() => {
              const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              // ask user for filename; fallback to timestamp
              const ts = new Date();
              const defaultName = `simspace-${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}-${String(ts.getMinutes()).padStart(2, '0')}.json`;
              const inputNameRaw = window.prompt('Enter filename for export (.json)', defaultName);
              if (inputNameRaw === null) { URL.revokeObjectURL(url); return; }
              let inputName = (inputNameRaw.trim() || defaultName).replace(/[\\/:*?"<>|]+/g, '-');
              if (!/\.json$/i.test(inputName)) inputName += '.json';
              a.download = inputName;
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
        <h3>Add Simulators</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button onClick={() => addTemplate('PRO AM', 80, 190, currentPalette[5] || '#9EABA2')}>Add <strong>PRO AM</strong> (80×190cm)</button>
          <button onClick={() => addTemplate('PRO', 100, 240, currentPalette[0] || '#A36361')}>Add <strong>PRO</strong> (100×240cm)</button>
        </div>
      </div>

      <div className="section">
        <h3>Add Object</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="obj-name">Name</label>
            <input id="obj-name" value={objName} onChange={(e) => setObjName(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: '1 / span 2' }}>
            <label className="label">Color</label>
            <div className="swatch-grid" role="listbox" aria-label="Theme colors">
              {currentPalette.map((c, idx) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch${objColor === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={objColor === c}
                  onClick={() => setObjColorIndex(idx)}
                />
              ))}
            </div>
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
        <h3>Add Doors</h3>
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

        {/* Door list removed; doors are shown and managed in Objects & Doors and top bar */}
      </div>

      <div className="section">
        <h3>Objects</h3>
        <div className="list">
          {state.objects.map((o) => (
            <div key={o.id} className={`list-item${state.selectedObjectId === o.id ? ' selected' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="color-swatch" style={{ background: o.color }} />
                <strong>{o.name}</strong>
                <span className="label">{Math.round(o.widthCm)}x{Math.round(o.depthCm)} cm</span>
                {o.kind === 'simulator' && o.monitor && o.monitor.layout !== 'none' && (
                  <span className="badge">{o.monitor.layout} {o.monitor.screenInches || ''}"</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { dispatch({ type: 'SELECT_OBJECT', id: o.id }); dispatch({ type: 'SELECT_DOOR', id: null }); }}>Select</button>
                <button className="danger" disabled={o.id === 'simulator'} onClick={() => dispatch({ type: 'DELETE_OBJECT', id: o.id })}>Delete</button>
              </div>
            </div>
          ))}
          {state.doors.map((d) => (
            <div key={d.id} className={`list-item${state.selectedDoorId === d.id ? ' selected' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge">Door</span>
                <strong>{d.wall}</strong>
                <span className="label">{Math.round(d.widthCm)} cm</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { dispatch({ type: 'SELECT_DOOR', id: d.id }); dispatch({ type: 'SELECT_OBJECT', id: null }); }}>Select</button>
                <button className="danger" onClick={() => dispatch({ type: 'SET_DOORS', doors: state.doors.filter((x) => x.id !== d.id) })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rotation controls moved to top bar; section removed */}
    </div>
  );
};


