export type Units = 'metric' | 'imperial';
export type ThemeName = 'soft' | 'vibrant' | 'slate' | 'default';

export interface RoomDimensions {
  widthCm: number; // internal unit: centimeters
  depthCm: number;
}

export interface SimulatorSpec {
  widthCm: number;
  depthCm: number;
}

export type Wall = 'north' | 'south' | 'east' | 'west';

export interface Door {
  id: string;
  wall: Wall;
  offsetCm: number; // distance from wall's origin corner (NW for north/east, SW for south/west)
  widthCm: number;
}

export interface PlacedObject {
  id: string;
  name: string;
  widthCm: number;
  depthCm: number;
  xCm: number; // center position in room coordinates (cm), origin at top-left inside walls
  yCm: number;
  rotationDeg: number; // 0 means aligned with room axes
  color: string;
  kind: 'simulator' | 'furniture';
  monitor?: MonitorAttachment; // optional monitor rig for simulators
  themeColorIndex?: number; // if set, color follows current theme palette at this index
}

export interface CanvasState {
  pxPerCm: number; // zoom level
  panX: number; // pixels
  panY: number; // pixels
  snapCm: number; // grid size in cm
}

export interface ProjectState {
  units: Units;
  theme?: ThemeName;
  room: RoomDimensions;
  simulator: SimulatorSpec;
  doors: Door[];
  objects: PlacedObject[];
  selectedObjectId: string | null;
  selectedDoorId: string | null;
  canvas: CanvasState;
  showDimensions?: boolean;
}

export type MonitorLayout = 'none' | 'single' | 'triple';

export interface MonitorAttachment {
  layout: MonitorLayout;
  screenInches?: 27 | 32 | 42 | 45 | 49 | 55 | 65;
  panelWidthCm: number; // resulting total width in cm (single: panel width; triple: total span)
  panelDepthCm: number; // depth footprint (stand/rig)
  gapCm?: number; // bezel gap for triples (per gap)
  angleDeg?: number; // for triple rigs: side panel angle relative to center
}


