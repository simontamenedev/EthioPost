import { FieldOption } from "../components/ui/entity-form";

export const STATUS_OPTIONS: FieldOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const ROLE_OPTIONS: FieldOption[] = [
  { value: "user", label: "User (view only)" },
  { value: "admin", label: "Admin (full access)" },
];

// lib/options.ts - append
export const COMMISSION_TYPE_OPTIONS = [
  { value: "flat", label: "Flat amount (ETB)" },
  { value: "percent", label: "Percentage (%)" },
];
export const COMMISSION_BASIS_OPTIONS = [
  { value: "txn_amount", label: "Transaction / sold amount" },
  { value: "fee_collected", label: "Fees collected from customers" },
  { value: "revenue", label: "Revenue generated" },
];