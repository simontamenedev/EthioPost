"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", loading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={loading ? () => undefined : onCancel} title={title} size="sm">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">
          <AlertTriangle size={20} />
        </span>
        <p className="text-sm leading-6 text-slate-700 dark:text-white/80">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
