import { ThemeName } from '../types';

const SOFT: string[] = ['#A36361','#D3A29D','#E8B298','#EECC8C','#BDD1C5','#9EABA2','#F2B8B5','#F5D0C5','#F7E2B7','#DCEBDD','#C8E1DC','#EAD7F1'];
const VIBRANT: string[] = ['#2563eb','#10b981','#f43f5e','#f59e0b','#22d3ee','#8b5cf6','#ef4444','#0ea5e9'];
const PRO: string[] = ['#475569','#0ea5e9','#64748b','#94a3b8','#334155','#1e293b'];
const DEFAULT_THEME: string[] = ['#ffc800','#58dda1','#474747','#000000','#ffffff'];

export function getPalette(theme: ThemeName | undefined): string[] {
  switch (theme) {
    case 'vibrant':
      return VIBRANT;
    case 'slate':
      return PRO;
    case 'default':
      return DEFAULT_THEME;
    case 'soft':
    default:
      return SOFT;
  }
}

// Default color indices for templates
export const DEFAULT_SIM_COLOR_INDEX_PRO_AM = 5; // sage
export const DEFAULT_SIM_COLOR_INDEX_PRO = 0; // rose

