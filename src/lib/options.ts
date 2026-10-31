import type { FieldOption } from "@/components/ui/entity-form";

export const STATUS_OPTIONS: FieldOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const ROLE_OPTIONS: FieldOption[] = [
  { value: "user", label: "User (view only)" },
  { value: "admin", label: "Admin (full access)" },
];
