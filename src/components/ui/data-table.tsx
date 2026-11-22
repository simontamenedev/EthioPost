"use client";

import { Fragment, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { card } from "./styles";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyHint?: string;
  /** Renders the right-hand actions cell; omit (or return null) for read-only tables. */
  renderActions?: (row: T) => ReactNode;
  /** Renders a narrow first column (e.g. an expand chevron) before all other columns. */
  renderExpandToggle?: (row: T) => ReactNode;
  /** Return content to show a full-width row under `row`; return null/undefined while collapsed. */
  renderExpanded?: (row: T) => ReactNode;
  page: number; // zero-based
  pageSize: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
};

const cellBase = "px-4 py-3.5 text-sm text-slate-700 dark:text-white/80";

export function DataTable<T>({
  columns, rows, getRowId, isLoading, isError, errorMessage, onRetry,
  emptyTitle = "Nothing here yet", emptyHint, renderActions, renderExpandToggle, renderExpanded,
  page, pageSize, hasNext, onPageChange,
}: DataTableProps<T>) {
  const hasActions = Boolean(renderActions);
  const hasToggle = Boolean(renderExpandToggle);
  const colSpan = columns.length + (hasActions ? 1 : 0) + (hasToggle ? 1 : 0);

  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              {hasToggle && (
                <th scope="col" className="w-px py-3 pl-3 pr-0">
                  <span className="sr-only">Expand</span>
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60", c.className)}>
                  {c.header}
                </th>
              ))}
              {hasActions && <th scope="col" className="w-px px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} aria-hidden>
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-4 w-full max-w-[160px] animate-pulse  bg-slate-200 dark:bg-white/10" /></td>
                  ))}
                </tr>
              ))}

            {!isLoading && isError && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center">
                  <TriangleAlert className="mx-auto text-red-500" size={26} />
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">Couldn’t load data</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-white/70">{errorMessage}</p>
                  {onRetry && <Button size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows?.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center">
                  <Inbox className="mx-auto text-slate-400 dark:text-white/40" size={28} />
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">{emptyTitle}</p>
                  {emptyHint && <p className="mt-1 text-xs text-slate-600 dark:text-white/70">{emptyHint}</p>}
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows?.map((row) => {
              const expanded = renderExpanded?.(row);
              return (
                <Fragment key={getRowId(row)}>
                  <tr className="transition-colors  dark:hover:bg-white/5">
                    {hasToggle && <td className="w-px py-3.5 pl-3 pr-0">{renderExpandToggle?.(row)}</td>}
                    {columns.map((c) => (
                      <td key={c.key} className={cn(cellBase, c.className)}>{c.cell(row)}</td>
                    ))}
                    {hasActions && <td className={cn(cellBase, "text-right")}>{renderActions?.(row)}</td>}
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50/60 dark:bg-white/[0.03]">
                      <td colSpan={colSpan} className="px-4 py-4">{expanded}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-white/10">
        <p className="text-xs text-slate-600 dark:text-white/70">
          Page {page + 1}{rows && rows.length > 0 ? ` · ${page * pageSize + 1}–${page * pageSize + rows.length}` : ""}
        </p>
        <div className="flex gap-2">
          <Button size="sm" aria-label="Previous page" icon={<ChevronLeft size={15} />} disabled={page === 0} onClick={() => onPageChange(page - 1)}>Prev</Button>
          <Button size="sm" aria-label="Next page" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
            Next <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}