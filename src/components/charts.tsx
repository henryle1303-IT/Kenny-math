'use client';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BRAND = '#2563eb';

export function ScoreLine({ data, max = 30 }: { data: { label: string; score: number }[]; max?: number }) {
  if (!data.length) return <Empty text="Finish a test to see your scores here." />;
  return (
    <div className="h-56 w-full" role="img" aria-label="Test scores over time">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, max]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke={BRAND} strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PercentBars({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <Empty text="Nothing to show yet." />;
  return (
    <div style={{ height: Math.max(160, data.length * 34) }} className="w-full" role="img" aria-label="Accuracy chart">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.value >= 85 ? '#10b981' : d.value >= 70 ? '#38bdf8' : d.value >= 50 ? '#f59e0b' : '#f43f5e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLine({ data, color = '#10b981' }: { data: { n: number; accuracy: number }[]; color?: string }) {
  if (!data.length) return <Empty text="Complete a Smart Review session to see your improvement." />;
  return (
    <div className="h-52 w-full" role="img" aria-label="Smart Review accuracy over time">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="n" tick={{ fontSize: 12 }} label={{ value: 'Session', position: 'insideBottom', offset: -2, fontSize: 12 }} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Line type="monotone" dataKey="accuracy" stroke={color} strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MasteryBars({ data }: { data: { name: string; value: number; fill: string }[] }) {
  if (!data.some((d) => d.value > 0)) return <Empty text="Skill levels appear after your first test." />;
  return (
    <div className="h-52 w-full" role="img" aria-label="Skills by mastery level">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-32 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-slate-500">{text}</div>;
}
