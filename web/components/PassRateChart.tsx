"use client";

import { useState } from "react";

export type Point = { label: string; sub: string; value: number; passed: number; cases: number };

// One series (pass rate per saved run) as bars, with the gate's minimum drawn as a dashed line.
export default function PassRateChart({ points, floor }: { points: Point[]; floor: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 260, L = 44, R = 12, T = 16, B = 46;
  const plotW = W - L - R, plotH = H - T - B;
  const y = (v: number) => T + plotH * (1 - v);
  const slot = plotW / points.length;
  const barW = Math.min(64, slot * 0.5);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pass rate of each saved run">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="tick" x={L - 8} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}%</text>
          </g>
        ))}
        <line className="floor" x1={L} x2={W - R} y1={y(floor)} y2={y(floor)} />
        <text className="floor-label" x={L + 6} y={y(floor) - 6} textAnchor="start">gate minimum {Math.round(floor * 100)}%</text>
        {points.map((p, i) => {
          const cx = L + slot * i + slot / 2;
          const top = y(p.value);
          const h = y(0) - top;
          const r = Math.min(4, h);
          return (
            <g key={p.label} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
              <rect x={cx - slot / 2} y={T} width={slot} height={plotH} fill="transparent" />
              <path
                d={`M${cx - barW / 2},${y(0)} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${y(0)} Z`}
                fill="var(--chart)"
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <text x={cx} y={top - 8} textAnchor="middle" style={{ font: "600 13px var(--mono)", fill: "var(--ink)" }}>
                {Math.round(p.value * 1000) / 10}%
              </text>
              <text className="tick" x={cx} y={H - B + 18} textAnchor="middle">{p.label}</text>
              <text className="tick" x={cx} y={H - B + 34} textAnchor="middle">{p.sub}</text>
            </g>
          );
        })}
        <line className="axis" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${((L + slot * hover + slot / 2) / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%` }}>
          <b>{points[hover].label}</b> · {points[hover].sub}
          <br />
          {points[hover].passed}/{points[hover].cases} questions right ({Math.round(points[hover].value * 1000) / 10}%)
        </div>
      )}
    </div>
  );
}
