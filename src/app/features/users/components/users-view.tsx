"use client";

import { RoleBadge, StatusBadge } from "../../../../components/ui/badge";
import { Column } from "../../../../components/ui/data-table";
import { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import { User, UserCreatePayload, UserUpdatePayload } from "../../../../lib/api/types";
import { useCurrentUser } from "../../../../lib/auth/use-auth";
import { ROLE_OPTIONS, STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "../hooks";
import { userCreateSchema, userUpdateSchema, type UserFormValues } from "../schema";

const columns: Column<User>[] = [
  {
    key: "name",
    header: "User",
    cell: (u) => (
      <div>
        <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">@{u.username}</p>
      </div>
    ),
  },
  { key: "email", header: "Email", cell: (u) => u.email },
  { key: "role", header: "Role", cell: (u) => <RoleBadge role={u.role} /> },
  { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
  { key: "created", header: "Created", cell: (u) => formatDate(u.created_at) },
];

const fields: FieldConfig<UserFormValues>[] = [
  { name: "name", label: "Full name", placeholder: "e.g. Abebe Kebede", autoComplete: "off" },
  { name: "username", label: "Username", placeholder: "e.g. abebe" },
  { name: "email", label: "Email", type: "email", placeholder: "name@example.com" },
  { name: "password", label: "Password", type: "password", placeholder: "At least 8 characters", autoComplete: "new-password", modes: ["create"] },
  {
    name: "password", label: "New password", type: "password", placeholder: "Leave blank to keep the current one",
    autoComplete: "new-password", modes: ["edit"],
  },
  { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, placeholder: "Select role" },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
];

export function UsersView() {
  const me = useCurrentUser();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();

  return (
    <ResourceManager<User, UserFormValues, UserCreatePayload, UserUpdatePayload>
      title="Users"
      description="Admins manage everything; users can view data once signed in."
      singular="user"
      searchPlaceholder="Search name, username or email…"
      columns={columns}
      useList={useUsers}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={userCreateSchema}
      updateSchema={userUpdateSchema}
      fields={fields}
      emptyValues={{ name: "", username: "", email: "", password: "", role: "user", status: "active" }}
      toFormValues={(u) => ({ name: u.name, username: u.username, email: u.email, password: "", role: u.role, status: u.status })}
      toCreatePayload={(v) => ({ name: v.name, username: v.username, email: v.email, password: v.password, role: v.role, status: v.status })}
      toUpdatePayload={(v) => ({
        name: v.name, username: v.username, email: v.email, role: v.role, status: v.status,
        ...(v.password ? { password: v.password } : {}),
      })}
      rowLabel={(u) => u.name}
      canDeleteRow={(u) => u.id !== me?.id}
      modalSize="sm"
    />
  );
}