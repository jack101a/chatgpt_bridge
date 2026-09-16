import React from 'react';

export interface GridPatternBackgroundProps {
  className?: string;
  strokeDasharray?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export const GridPatternBackground: React.FC<GridPatternBackgroundProps> = ({
  className = '',
  strokeDasharray = '4 4',
  width = 32,
  height = 32,
  x = -1,
  y = -1,
}) => {
  const patternId = 'subtle-grid-pattern';

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full stroke-zinc-900/10 dark:stroke-white/[0.07] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={patternId}
            width={width}
            height={height}
            patternUnits="userSpaceOnUse"
            x={x}
            y={y}
          >
            <path
              d={`M.5 ${height}V.5H${width}`}
              fill="none"
              strokeDasharray={strokeDasharray}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
};
