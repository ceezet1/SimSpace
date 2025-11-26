import React from 'react';
import { PRO_N_SVG_PATH_D, PRO_N_BOUNDS } from '../assets/proSvgPath';

export interface ProShapeProps {
  widthPx: number;
  heightPx: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  showDebug?: boolean;
  onMeasured?: (bbox: { x: number; y: number; width: number; height: number }) => void;
}

export const ProShape: React.FC<ProShapeProps> = ({
  widthPx,
  heightPx,
  fill = 'rgba(0,0,0,0.4)',
  stroke = 'var(--object-stroke)',
  strokeWidth = 1,
  opacity = 1,
  showDebug = false,
  onMeasured,
}) => {
  const sx = widthPx / PRO_N_BOUNDS.width;
  const sy = heightPx / PRO_N_BOUNDS.height;
  const transform = `scale(${sx}, ${sy}) translate(${-PRO_N_BOUNDS.minX}, ${-PRO_N_BOUNDS.minY})`;

  return (
    <>
      {showDebug && (
        <rect x={0} y={0} width={widthPx} height={heightPx} fill="none" stroke="var(--muted)" strokeDasharray="6 4" strokeWidth={1} opacity={0.4} />
      )}
      <g
        transform={transform}
        ref={(node) => {
          if (node && onMeasured) {
            const box = node.getBBox();
            onMeasured({ x: box.x, y: box.y, width: box.width, height: box.height });
          }
        }}
      >
        <path d={PRO_N_SVG_PATH_D} fill={fill} stroke={stroke} strokeWidth={strokeWidth / Math.max(sx, sy)} opacity={opacity} />
      </g>
    </>
  );
};


