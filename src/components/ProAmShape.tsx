import React from 'react';
import { PRO_AM_SVG_PATH_D, PRO_AM_BOUNDS } from '../assets/proSvgPath';

export interface ProAmShapeProps {
  widthPx: number;
  heightPx: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  showDebug?: boolean;
}

export const ProAmShape: React.FC<ProAmShapeProps> = ({
  widthPx,
  heightPx,
  fill = 'rgba(0,0,0,0.4)',
  stroke = 'var(--object-stroke)',
  strokeWidth = 1,
  opacity = 1,
  showDebug = false,
}) => {
  const sx = widthPx / PRO_AM_BOUNDS.width;
  const sy = heightPx / PRO_AM_BOUNDS.height;
  const transform = `scale(${sx}, ${sy}) translate(${-PRO_AM_BOUNDS.minX}, ${-PRO_AM_BOUNDS.minY})`;

  return (
    <>
      {showDebug && (
        <rect
          x={0}
          y={0}
          width={widthPx}
          height={heightPx}
          fill="none"
          stroke="var(--muted)"
          strokeDasharray="6 4"
          strokeWidth={1}
          opacity={0.4}
        />
      )}
      <g transform={transform}>
        <path d={PRO_AM_SVG_PATH_D} fill={fill} stroke={stroke} strokeWidth={strokeWidth / Math.max(sx, sy)} opacity={opacity} />
      </g>
    </>
  );
};


