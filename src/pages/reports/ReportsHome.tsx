import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2, AlertTriangle, ArrowRight, Lock,
  Truck, UserSquare2, Database as DbIcon, Users, DollarSign,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canViewReports } from '../../lib/rbac';
import { AccessDenied } from '../../components/ui/AccessDenied';
import { reportService } from '../../services/report.service';
import type { ExceptionType } from '../../services/report.service';
import { cn } from '../../lib/utils';

interface ExceptionBadge {
  type:  ExceptionType;
  label: string;
  color: string;
  text:  string;
}

const EXCEPTION_BADGES: ExceptionBadge[] = [
  { type: 'dumpyard_required', label: 'Dumpyard Req.',   color: 'bg-red-100',    text: 'text-red-700'    },
  { type: 'missing_driver',    label: 'No Driver',       color: 'bg-red-100',    text: 'text-red-700'    },
  { type: 'delayed',           label: 'Delayed (>4 h)',  color: 'bg-amber-100',  text: 'text-amber-700'  },
  { type: 'missing_dumpster',  label: 'No Dumpster',     color: 'bg-amber-100',  text: 'text-amber-700'  },
  { type: 'cancelled',         label: "Cancelled Today", color: 'bg-gray-100',   text: 'text-gray-700'   },
  { type: 'missing_value',     label: 'Missing Value',   color: 'bg-blue-100',   text: 'text-blue-700'   },
];

interface ReportTile {
  title:       string;
  description: string;
  href?:       string;
  icon:        React.FC<{ className?: string }>;
  available:   boolean;
  phase:       string;
}

const REPORT_TILES: ReportTile[] = [
  {
    title:       'Operations Report',
    description: 'Load volume, status breakdown, daily trend, and delayed loads.',
    href:        '/reports/operations',
    icon:        BarChart2,
    available:   true,
    phase:       'Phase 1',
  },
  {
    title:       'Exception Report',
    description: 'Dumpyard-required, delayed, missing assignment, and incomplete data.',
    href:        '/reports/exceptions',
    icon:        AlertTriangle,
    available:   true,
    phase:       'Phase 1',
  },
  {
    title:       'Driver Performance',
    description: 'Loads completed, working hours, active vs idle time per driver.',
    icon:        UserSquare2,
    available:   false,
    phase:       'Phase 2',
  },
  {
    title:       'Dumpster Utilization',
    description: 'Rentals, deployed days, idle days, and utilization percentage.',
    icon:        DbIcon,
    available:   false,
    phase:       'Phase 2',
  },
  {
    title:       'Customer / Project',
    description: 'Loads and revenue by customer and site.',
    icon:        Users,
    available:   false,
    phase:       'Phase 3',
  },
  {
    title:       'Financial Summary',
    description: 'Revenue, gross profit, margin, and profit by driver or customer.',
    icon:        DollarSign,
    available:   false,
    phase:       'Phase 4',
  },
];

export function ReportsHome() {
  const { profile, appReady } = useAuth();
  const role = profile?.role ?? null;

  const [counts, setCounts]         = useState<Record<ExceptionType, number> | null>(null);
  const [countsLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    setLoading(true);
    reportService
      .fetchExceptionCounts(profile.tenant_id)
      .then(setCounts)
      .catch(() => setCounts(null))
      .finally(() => setLoading(false));
  }, [appReady, profile?.tenant_id]);

  if (appReady && !canViewReports(role)) return <AccessDenied />;

  const totalExceptions = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-600" />
          Reports
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Operational and financial visibility for your tenant.
        </p>
      </div>

      {/* Live exceptions strip */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-900">Live Exceptions</span>
            {!countsLoading && totalExceptions > 0 && (
              <span className="text-xs font-bold text-white bg-red-500 rounded-full px-2 py-0.5">
                {totalExceptions}
              </span>
            )}
          </div>
          <Link
            to="/reports/exceptions"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            View Report <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="px-4 py-3">
          {countsLoading ? (
            <div className="flex gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {EXCEPTION_BADGES.map((b) => {
                const n = counts?.[b.type] ?? 0;
                return (
                  <span
                    key={b.type}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border',
                      n > 0
                        ? `${b.color} ${b.text} border-transparent`
                        : 'bg-gray-50 text-gray-400 border-gray-100',
                    )}
                  >
                    <span className="font-bold">{n}</span>
                    {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Report tiles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TILES.map((tile) => (
          <ReportCard key={tile.title} tile={tile} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ tile }: { tile: ReportTile }) {
  const Icon = tile.icon;

  if (!tile.available) {
    return (
      <div className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-5 opacity-60 cursor-not-allowed select-none">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-500">{tile.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{tile.description}</p>
          </div>
          <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
        </div>
        <span className="absolute top-3 right-3 text-xs text-gray-300 font-medium">
          {tile.phase}
        </span>
      </div>
    );
  }

  return (
    <Link
      to={tile.href!}
      className="group bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{tile.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tile.description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
      </div>
    </Link>
  );
}
