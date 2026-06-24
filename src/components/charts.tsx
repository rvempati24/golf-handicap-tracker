"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export type SeriesPoint = Record<string, number | string | null>;

export function TrendLineChart({
  data,
  lines,
  height = 240,
  yDomain,
  reversed = false,
}: {
  data: SeriesPoint[];
  lines: { key: string; label: string; color: string }[];
  height?: number;
  yDomain?: [number | "auto", number | "auto"];
  /** Reverse Y axis (lower is better, e.g. scores). */
  reversed?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted"
        style={{ height }}
      >
        Not enough data yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--color-muted)" }}
          stroke="var(--color-border)"
          minTickGap={16}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-muted)" }}
          stroke="var(--color-border)"
          domain={yDomain ?? ["auto", "auto"]}
          reversed={reversed}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--color-foreground)",
          }}
          labelStyle={{ color: "var(--color-muted)" }}
        />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
