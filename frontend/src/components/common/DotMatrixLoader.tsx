import React, { useEffect, useRef } from 'react';

export interface DotMatrixLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  speed?: number;
  variant?: 'hex' | 'square' | 'prism';
  className?: string;
  label?: string;
  dotColor?: string;
  activeColor?: string;
}

export const DotMatrixLoader: React.FC<DotMatrixLoaderProps> = ({
  size = 'md',
  speed = 1,
  variant = 'hex',
  className = '',
  label,
  dotColor,
  activeColor = '#10a37f',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dimension mapping
  const dimensions = {
    sm: { width: 48, height: 48, dotRadius: 1.5, spacing: 6, rows: 5, cols: 5 },
    md: { width: 84, height: 84, dotRadius: 2.2, spacing: 9, rows: 7, cols: 7 },
    lg: { width: 140, height: 140, dotRadius: 3.2, spacing: 14, rows: 9, cols: 9 },
  }[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const render = () => {
      time += 0.04 * speed;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const { dotRadius, spacing, rows, cols } = dimensions;

      const isDark = document.documentElement.classList.contains('dark');
      const defaultDotColor = dotColor || (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)');

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const offsetX = (c - (cols - 1) / 2) * spacing;
          const offsetY = (r - (rows - 1) / 2) * spacing;
          const x = centerX + offsetX;
          const y = centerY + offsetY;

          let intensity = 0;
          const distFromCenter = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

          if (variant === 'hex') {
            // Hexagonal orbital wave
            const angle = Math.atan2(offsetY, offsetX);
            const wave = Math.sin(angle * 3 + time * 2 - distFromCenter * 0.08);
            intensity = Math.max(0, wave);
          } else if (variant === 'prism') {
            // Prism bloom expanding ring
            const wave = Math.sin(distFromCenter * 0.18 - time * 2.5);
            intensity = Math.pow(Math.max(0, wave), 3);
          } else {
            // Square matrix cascade
            const wave = Math.sin((c + r) * 0.6 - time * 2.5);
            intensity = Math.max(0, wave);
          }

          ctx.beginPath();
          ctx.arc(x, y, dotRadius + (intensity > 0.3 ? intensity * 0.8 : 0), 0, Math.PI * 2);

          if (intensity > 0.25) {
            ctx.fillStyle = activeColor;
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = intensity * 6;
          } else {
            ctx.fillStyle = defaultDotColor;
            ctx.shadowBlur = 0;
          }

          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [size, speed, variant, activeColor, dotColor, dimensions]);

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block transition-opacity duration-300"
      />
      {label && (
        <span className="mt-2 text-xs font-mono tracking-wider uppercase text-muted-foreground animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};
