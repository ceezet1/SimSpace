import React from 'react';
import { PRO_N_SVG_PATH_D, PRO_N_VIEWBOX_WIDTH, PRO_N_VIEWBOX_HEIGHT } from '../assets/proSvgPath';

interface ProShapeProps {
  widthPx: number;
  heightPx: number;
  fill?: string;
  stroke?: string;
}

export const ProShape: React.FC<ProShapeProps> = ({
  widthPx,
  heightPx,
  fill = 'rgba(0,0,0,0.4)',
  stroke = 'var(--object-stroke)',
}) => {
  const sx = widthPx / PRO_N_VIEWBOX_WIDTH;
  const sy = heightPx / PRO_N_VIEWBOX_HEIGHT;
  const transform = `translate(${widthPx / 2}, ${heightPx / 2}) scale(${sx}, ${sy}) translate(${-PRO_N_VIEWBOX_WIDTH / 2}, ${-PRO_N_VIEWBOX_HEIGHT / 2})`;

  return (
    <g transform={transform}>
      <path d={PRO_N_SVG_PATH_D} fill={fill} stroke={stroke} />
    </g>
  );
};


