import { ProjectState } from '../types';

const STORAGE_KEY = 'room-sim-planner:v1';

export function saveState(state: ProjectState): void {
  try {
    const toStore = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, toStore);
  } catch (e) {
    // ignore
  }
}

export function loadState(): ProjectState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectState;
  } catch {
    return null;
  }
}


