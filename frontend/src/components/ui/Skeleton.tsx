import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full flex items-center justify-between px-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6"></div>
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20"></div>
        </div>
      ))}
    </div>
  );
};
