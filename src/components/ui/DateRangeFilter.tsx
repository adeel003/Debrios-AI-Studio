import React, { useState } from 'react';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays,
} from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to:   string; // YYYY-MM-DD
}

interface Props {
  value:    DateRange;
  onChange: (range: DateRange) => void;
}

type PresetKey = 'today' | 'this_week' | 'last_7' | 'this_month' | 'last_30' | 'last_90' | 'custom';

function isoDate(d: Date): string {
  // Local-date string — avoids UTC-shift artefacts when building date-only ranges.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Preset {
  key:   PresetKey;
  label: string;
  range: () => DateRange;
}

const PRESETS: Preset[] = [
  {
    key:   'today',
    label: 'Today',
    range: () => { const t = isoDate(new Date()); return { from: t, to: t }; },
  },
  {
    key:   'this_week',
    label: 'This Week',
    range: () => ({
      from: isoDate(startOfWeek(new Date(), { weekStartsOn: 0 })),
      to:   isoDate(endOfWeek(new Date(),   { weekStartsOn: 0 })),
    }),
  },
  {
    key:   'last_7',
    label: 'Last 7d',
    range: () => ({ from: isoDate(subDays(new Date(), 6)), to: isoDate(new Date()) }),
  },
  {
    key:   'this_month',
    label: 'This Month',
    range: () => ({
      from: isoDate(startOfMonth(new Date())),
      to:   isoDate(endOfMonth(new Date())),
    }),
  },
  {
    key:   'last_30',
    label: 'Last 30d',
    range: () => ({ from: isoDate(subDays(new Date(), 29)), to: isoDate(new Date()) }),
  },
  {
    key:   'last_90',
    label: 'Last 90d',
    range: () => ({ from: isoDate(subDays(new Date(), 89)), to: isoDate(new Date()) }),
  },
];

export function defaultDateRange(): DateRange {
  return PRESETS.find((p) => p.key === 'last_30')!.range();
}

export function DateRangeFilter({ value, onChange }: Props) {
  const [activePreset, setActivePreset] = useState<PresetKey>('last_30');

  function applyPreset(p: Preset) {
    setActivePreset(p.key);
    onChange(p.range());
  }

  function setFrom(from: string) {
    setActivePreset('custom');
    onChange({ ...value, from });
  }

  function setTo(to: string) {
    setActivePreset('custom');
    onChange({ ...value, to });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />

      {/* Preset pills */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              activePreset === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-xs">—</span>
        <input
          type="date"
          value={value.to}
          min={value.from}
          onChange={(e) => setTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
