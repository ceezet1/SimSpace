export type Units = 'metric' | 'imperial';

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
}

export interface CanvasState {
  pxPerCm: number; // zoom level
  panX: number; // pixels
  panY: number; // pixels
  snapCm: number; // grid size in cm
}

export interface ProjectState {
  units: Units;
  room: RoomDimensions;
  simulator: SimulatorSpec;
  doors: Door[];
  objects: PlacedObject[];
  selectedObjectId: string | null;
  selectedDoorId: string | null;
  canvas: CanvasState;
}


