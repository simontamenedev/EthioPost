"use client";

import { useEffect } from "react";
import { get, useForm, useWatch, type DefaultValues, type FieldValues, type Path, type PathValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { inputBase } from "./styles";

export type FieldOption = { value: string; label: string };

export type FieldConfig<T extends FieldValues> = {
  name: Path<T>;
  label: string;
 type?: "text" | "email" | "password" | "textarea" | "select" | "date";
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  /** grid columns this field spans on ≥sm screens (default 1) */
  span?: 1 | 2;
  /** static options, or computed from the current form values (dependent selects) */
  options?: FieldOption[] | ((values: T) => FieldOption[]);
  /** clear this field whenever the named field changes (e.g. branch ← district) */
  resetOn?: Path<T>;
  /** only render in these modes (e.g. password on create) */
  modes?: Array<"create" | "edit">;
};

type EntityFormProps<T extends FieldValues> = {
  schema: z.ZodType<T, T>;
  fields: FieldConfig<T>[];
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => Promise<void> | void;
  onCancel: () => void;
  submitLabel: string;
  serverError?: string | null;
};

const labelClass = "mb-0.5 block text-xs font-semibold text-slate-800 dark:text-white";

// Compact control size. The "!" forces these over whatever inputBase sets.
const compact = "!rounded-lg !px-2.5 !py-1.5 !text-xs";
const textareaClass = "block w-full resize-none appearance-none overflow-y-auto leading-snug";

export function EntityForm<T extends FieldValues>({
  schema, fields, defaultValues, onSubmit, onCancel, submitLabel, serverError,
}: EntityFormProps<T>) {
  const { register, handleSubmit, control, setValue, setFocus, formState: { errors, isSubmitting } } = useForm<T, unknown, T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const values = useWatch({ control }) as T;
  const firstField = fields[0]?.name;
  useEffect(() => {
    if (firstField) setFocus(firstField);
  }, [firstField, setFocus]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div className="grid  gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `field-${field.name}`;
          const errorId = `${id}-error`;
          const message = (get(errors, field.name) as { message?: string } | undefined)?.message;
          const options = typeof field.options === "function" ? field.options(values) : (field.options ?? []);

          const common = {
            id,
            "aria-invalid": message ? true : undefined,
            "aria-describedby": message ? errorId : undefined,
          } as const;

          const registration = register(field.name, {
            onChange: () => {
              for (const other of fields) {
                if (other.resetOn === field.name) setValue(other.name, "" as PathValue<T, Path<T>>);
              }
            },
          });

          return (
            <div key={field.name} className={cn(field.span === 2 || field.type === "textarea" ? "sm:col-span-2" : "")}>
              <label htmlFor={id} className={labelClass}>{field.label}</label>

              {field.type === "textarea" ? (
                <textarea
                  rows={2}
                  placeholder={field.placeholder}
                  {...common}
                  {...registration}
                  className={cn(inputBase, compact, textareaClass)}
                />
              ) : field.type === "select" ? (
                <select {...common} {...registration} className={cn(inputBase, compact)}>
                  <option value="">{field.placeholder ?? "Select…"}</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete ?? "off"}
                  {...common}
                  {...registration}
                  className={cn(inputBase, compact)}
                />
              )}

              {field.hint && !message && <p className="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-white/60">{field.hint}</p>}
              {message && <p id={errorId} role="alert" className="mt-0.5 text-[11px] font-medium leading-tight text-red-600 dark:text-red-300">{message}</p>}
            </div>
          );
        })}
      </div>

      {serverError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-0.5">
        <Button onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}