import { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export function Card({ title, description, badge, actions, children, className = "", id }: CardProps) {
  return (
    <div
      id={id}
      className={`rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm shadow-slate-200/50 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-none ${className}`}
    >
      {(title || description || badge || actions) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title && <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h2>}
            {description && <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>}
          </div>
          {(badge || actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {badge}
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
