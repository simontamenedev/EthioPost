import type { User, UserCreatePayload, UserUpdatePayload } from "../../../lib/api/types";
import { createCrudHooks } from "../../../lib/api/crud-hooks";

const users = createCrudHooks<User, UserCreatePayload, UserUpdatePayload, { role?: string }>("users");

export const userKeys = users.keys;
export const useUsers = users.useList;
export const useUser = users.useOne;
export const useCreateUser = users.useCreate;
export const useUpdateUser = users.useUpdate;
export const useDeleteUser = users.useDelete;
