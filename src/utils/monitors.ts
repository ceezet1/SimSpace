import { MonitorAttachment, MonitorLayout } from '../types';

// Approximate visible widths for 16:9 monitors (bezel-to-bezel), + rig depth
const PANEL_WIDTH_CM: Record<number, number> = {
  27: 60, // typical 27" width ~ 60cm
  32: 71, // typical 32" width ~ 71cm
};

const PANEL_DEPTH_CM: Record<number, number> = {
  27: 20,
  32: 25,
};

export type MonitorKey = 'none' | 'single-49' | 'triple-42' | 'triple-45c' | 'triple-55' | 'triple-65';

export function getMonitorAttachment(key: MonitorKey): MonitorAttachment | undefined {
  if (key === 'none') return { layout: 'none', panelWidthCm: 0, panelDepthCm: 0, presetKey: 'none' };
  const gap = 2; // cm per gap for triples
  switch (key) {
    case 'single-49': {
      // 49" ultrawide ~ 119cm width, depth ~ 30cm
      return { layout: 'single', screenInches: 49, panelWidthCm: 119, panelDepthCm: 30, presetKey: key };
    }
    case 'triple-42': {
      // 42" ~ 93cm wide per panel, depth ~ 30cm
      const w = 93;
      return { layout: 'triple', screenInches: 42, panelWidthCm: w * 3 + gap * 2, panelDepthCm: 30 + 10, gapCm: gap, angleDeg: 60, presetKey: key };
    }
    case 'triple-45c': {
      // 45" curved ~ 105cm per panel, depth ~ 32cm
      const w = 105;
      return { layout: 'triple', screenInches: 45, panelWidthCm: w * 3 + gap * 2, panelDepthCm: 32 + 10, gapCm: gap, angleDeg: 60, presetKey: key };
    }
    case 'triple-55': {
      const w = 121;
      return { layout: 'triple', screenInches: 55, panelWidthCm: w * 3 + gap * 2, panelDepthCm: 35 + 10, gapCm: gap, angleDeg: 60, presetKey: key };
    }
    case 'triple-65': {
      const w = 144;
      return { layout: 'triple', screenInches: 65, panelWidthCm: w * 3 + gap * 2, panelDepthCm: 40 + 10, gapCm: gap, angleDeg: 60, presetKey: key };
    }
    default:
      return undefined;
  }
}

