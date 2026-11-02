"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { DefaultValues, FieldValues } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "./badge";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { DataTable, type Column } from "./data-table";
import { EntityForm, type FieldConfig } from "./entity-form";
import { Modal } from "./modal";
import { focusRing, inputBase } from "./styles";
import { ListParams, Status } from "../../lib/api/types";
import { useIsAdmin } from "../../lib/auth/use-auth";
import { useDebouncedValue } from "../../lib/hooks/use-debounced-value";
import { errorMessage } from "../../lib/api/client";
import { cn } from "../../lib/utils";

const PAGE_SIZE = 10;

type QueryLike<TRow> = {
  data: TRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => unknown;
};
type MutationLike<V> = { mutateAsync: (variables: V) => Promise<unknown>; isPending: boolean };

type ResourceManagerProps<TRow extends { id: string }, TForm extends FieldValues, TCreate, TUpdate> = {
  title: string;
  description: string;
  /** "district" → "Add district", "District created" … */
  singular: string;
  searchPlaceholder?: string;

  columns: Column<TRow>[];
  useList: (params: ListParams) => QueryLike<TRow>;
  createMutation: MutationLike<TCreate>;
  updateMutation: MutationLike<{ id: string; data: TUpdate }>;
  deleteMutation: MutationLike<string>;

  createSchema: z.ZodType<TForm, TForm>;
  updateSchema?: z.ZodType<TForm, TForm>;
  fields: FieldConfig<TForm>[];
  emptyValues: DefaultValues<TForm>;
  toFormValues: (row: TRow) => DefaultValues<TForm>;
  toCreatePayload: (values: TForm) => TCreate;
  toUpdatePayload: (values: TForm) => TUpdate;

  rowLabel: (row: TRow) => string;
  /** e.g. stop an admin deleting their own account */
  canDeleteRow?: (row: TRow) => boolean;
  toolbarExtra?: ReactNode;
  /** width of the add/edit modal */
  modalSize?: "sm" | "md" | "lg";
};

type ModalState<TRow> = { mode: "create" } | { mode: "edit"; row: TRow } | null;

export function ResourceManager<TRow extends { id: string }, TForm extends FieldValues, TCreate, TUpdate>({
  title, description, singular, searchPlaceholder = "Search…",
  columns, useList, createMutation, updateMutation, deleteMutation,
  createSchema, updateSchema, fields, emptyValues, toFormValues, toCreatePayload, toUpdatePayload,
  rowLabel, canDeleteRow, toolbarExtra, modalSize = "md",
}: ResourceManagerProps<TRow, TForm, TCreate, TUpdate>) {
  const isAdmin = useIsAdmin();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const q = useDebouncedValue(search.trim());

  const [modal, setModal] = useState<ModalState<TRow>>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TRow | null>(null);

  // Ask for one extra row to know whether a next page exists.
  const query = useList({ skip: page * PAGE_SIZE, limit: PAGE_SIZE + 1, q: q || undefined, status: status || undefined });
  const rows = query.data?.slice(0, PAGE_SIZE);
  const hasNext = (query.data?.length ?? 0) > PAGE_SIZE;

  const closeModal = useCallback(() => {
    setModal(null);
    setServerError(null);
  }, []);

  async function handleSubmit(values: TForm) {
    setServerError(null);
    try {
      if (modal?.mode === "edit") {
        await updateMutation.mutateAsync({ id: modal.row.id, data: toUpdatePayload(values) });
        toast.success(`${capitalize(singular)} updated`);
      } else {
        await createMutation.mutateAsync(toCreatePayload(values));
        toast.success(`${capitalize(singular)} created`);
      }
      closeModal();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success(`${capitalize(singular)} deleted`);
      // deleted the only row on this page → step back one page
      if (page > 0 && rows?.length === 1) setPage(page - 1);
      setToDelete(null);
    } catch (error) {
      toast.error(errorMessage(error));
      setToDelete(null);
    }
  }

  const mode = modal?.mode ?? "create";
  const visibleFields = fields.filter((f) => !f.modes || f.modes.includes(mode));
  const schema = mode === "edit" ? (updateSchema ?? createSchema) : createSchema;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-5 py-8 sm:px-8 lg:px-10">
      {/* Page header: title + description on the left, primary action on the right */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#2c317b] dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-white/70">{description}</p>
        </div>
        <div className="shrink-0">
          {isAdmin ? (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
              Add {singular}
            </Button>
          ) : (
            <Badge tone="blue">View only</Badge>
          )}
        </div>
      </div>

      {/* Toolbar: search grows, filter has a fixed width, same height for both */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className={cn(inputBase, "h-10 pl-10")}
          />
        </div>
        <div className="w-full sm:w-44">
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => { setStatus(e.target.value as Status | ""); setPage(0); }}
            className={cn(inputBase, "h-10")}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {toolbarExtra && <div className="flex items-center gap-2 sm:ml-auto">{toolbarExtra}</div>}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error?.message}
        onRetry={() => void query.refetch()}
        emptyTitle={q || status ? "No matches" : `No ${title.toLowerCase()} yet`}
        emptyHint={q || status ? "Try a different search or filter." : isAdmin ? `Use “Add ${singular}” to create the first one.` : undefined}
        page={page}
        pageSize={PAGE_SIZE}
        hasNext={hasNext}
        onPageChange={setPage}
        renderActions={
          isAdmin
            ? (row) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${rowLabel(row)}`}
                    onClick={() => setModal({ mode: "edit", row })}
                    className={cn("rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10", focusRing)}
                  >
                    <Pencil size={16} />
                  </button>
                  {(canDeleteRow?.(row) ?? true) && (
                    <button
                      type="button"
                      aria-label={`Delete ${rowLabel(row)}`}
                      onClick={() => setToDelete(row)}
                      className={cn("rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10", focusRing)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )
            : undefined
        }
      />

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={mode === "edit" ? `Edit ${singular}` : `Add ${singular}`}
        description={mode === "edit" ? "Update the details and save your changes." : `Fill in the details to create a new ${singular}.`}
        size={modalSize}
      >
        {modal && (
          <EntityForm<TForm>
            key={modal.mode === "edit" ? modal.row.id : "create"}
            schema={schema}
            fields={visibleFields}
            defaultValues={modal.mode === "edit" ? toFormValues(modal.row) : emptyValues}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            submitLabel={modal.mode === "edit" ? "Save changes" : `Create ${singular}`}
            serverError={serverError}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${singular}?`}
        message={toDelete ? `“${rowLabel(toDelete)}” will be removed. This can’t be undone from the dashboard.` : ""}
        loading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}