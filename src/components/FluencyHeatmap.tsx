import React, { useState, useEffect } from 'react';
import { Flame, Calendar, Trophy, Clock } from 'lucide-react';
import { getDailyActivity, getActivityStats } from '../services/activityService';
import type { DailyActivityRecord } from '../types';

export const FluencyHeatmap: React.FC = () => {
  const [activity, setActivity] = useState<Record<string, DailyActivityRecord>>({});
  const [stats, setStats] = useState(() => getActivityStats());
  const [hoveredDay, setHoveredDay] = useState<{ date: string; data?: DailyActivityRecord } | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setActivity(getDailyActivity());
      setStats(getActivityStats());
    };
    window.addEventListener('fluency_activity_updated', handleUpdate);
    return () => window.removeEventListener('fluency_activity_updated', handleUpdate);
  }, []);

  // Generate last 16 weeks (112 days) for optimal mobile/tablet/desktop fit
  const daysToShow = 112;
  const days: { dateStr: string; record?: DailyActivityRecord }[] = [];
  const today = new Date();

  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      dateStr,
      record: activity[dateStr],
    });
  }

  const getCellColor = (record?: DailyActivityRecord) => {
    if (!record || record.minutes === 0) return 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200/50 dark:border-slate-700/50';
    if (record.minutes >= 20) return 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-xs';
    if (record.minutes >= 10) return 'bg-emerald-400 hover:bg-emerald-300 border-emerald-400';
    return 'bg-emerald-200 dark:bg-emerald-800/80 hover:bg-emerald-300 border-emerald-300 dark:border-emerald-700';
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
              365-Day Spoken Immersion Heatmap
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Consistency builds fluency · Track your daily speaking minutes
            </p>
          </div>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600 dark:text-slate-300">
          <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            {stats.currentStreak} Day Streak
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            {Math.round(stats.totalMinutes / 60)}h Spoken
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {stats.totalXP} XP
          </span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="relative overflow-x-auto pb-1">
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 w-max">
          {days.map(({ dateStr, record }) => (
            <button
              key={dateStr}
              type="button"
              onMouseEnter={() => setHoveredDay({ date: dateStr, data: record })}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => setHoveredDay({ date: dateStr, data: record })}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border transition-all ${getCellColor(
                record
              )}`}
              title={`${dateStr}: ${record?.minutes || 0} mins spoken, +${record?.xp || 0} XP`}
              aria-label={`${dateStr}: ${record?.minutes || 0} minutes spoken`}
            />
          ))}
        </div>
      </div>

      {/* Tooltip & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 gap-2">
        <div className="min-h-[1.25rem]">
          {hoveredDay ? (
            <span className="text-slate-800 dark:text-slate-100 font-semibold animate-fade-in">
              📅 {hoveredDay.date}:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {hoveredDay.data?.minutes || 0} minutes spoken
              </strong>{' '}
              ({hoveredDay.data?.xp || 0} XP earned)
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">Hover or tap any square to inspect daily practice</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 self-end sm:self-auto">
          <span>Less</span>
          <span className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
          <span className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-800/80 border border-emerald-300 dark:border-emerald-700" />
          <span className="w-3 h-3 rounded-sm bg-emerald-400 border border-emerald-400" />
          <span className="w-3 h-3 rounded-sm bg-emerald-600 border border-emerald-500" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
