import React from 'react';

interface HealthDiskProps {
  hp: number;
  maxHp: number;
  shield?: number;
  isZombie?: boolean;
  isExtracted?: boolean;
  color?: string;
  size?: number;
}

export const HealthDisk: React.FC<HealthDiskProps> = ({
  hp,
  maxHp,
  shield = 0,
  isZombie = false,
  isExtracted = false,
  color = '#38bdf8',
  size = 24,
}) => {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - ratio);

  const fillTone = isExtracted
    ? '#f59e0b'
    : isZombie
      ? '#84cc16'
      : ratio > 0.5
        ? '#38bdf8'
        : ratio > 0.25
          ? '#f59e0b'
          : '#ef4444';

  const sweepAngle = ratio * 360;
  const rad = ((sweepAngle - 90) * Math.PI) / 180;
  const endX = 12 + 7 * Math.cos(rad);
  const endY = 12 + 7 * Math.sin(rad);
  const largeArc = sweepAngle > 180 ? 1 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0 overflow-visible"
      aria-label={isZombie ? 'Infectado' : isExtracted ? 'Salvado' : `Salud ${Math.round(ratio * 100)}%`}
    >
      {/* Subtle marble core */}
      <circle cx="12" cy="12" r="7.5" fill="rgba(15, 23, 42, 0.72)" />

      {/* Filled Pie Disk Sector representing remaining health */}
      {ratio >= 0.999 ? (
        <circle cx="12" cy="12" r="7" fill={fillTone} fillOpacity="0.88" />
      ) : ratio > 0.01 ? (
        <path
          d={`M 12 12 L 12 5 A 7 7 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)} Z`}
          fill={fillTone}
          fillOpacity="0.9"
        />
      ) : null}

      {/* Center color pip identifying the marble */}
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill={isZombie ? '#4ade80' : color}
        stroke="#090b12"
        strokeWidth="1"
      />

      {/* Outer progress track */}
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="2"
      />

      {/* Outer crisp radial arc */}
      {ratio > 0 && (
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={fillTone}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 12 12)"
        />
      )}

      {/* Shield outer halo */}
      {shield > 0 && !isZombie && (
        <circle
          cx="12"
          cy="12"
          r="11.2"
          fill="none"
          stroke="#67e8f9"
          strokeWidth="1.4"
          strokeOpacity="0.85"
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
};
