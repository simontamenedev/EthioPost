import { z } from "zod";

const base = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Max 150 characters"),
  username: z.string().trim().min(3, "At least 3 characters").max(50, "Max 50 characters"),
  email: z.email("Enter a valid email address"),
  role: z.enum(["admin", "user"]),
  status: z.enum(["active", "inactive"]),
});

export const userCreateSchema = base.extend({
  password: z.string().min(8, "At least 8 characters").max(64, "Max 64 characters"),
});

/** On edit, an empty password means "keep the current one". */
export const userUpdateSchema = base.extend({
  password: z.union([z.literal(""), z.string().min(8, "At least 8 characters").max(64, "Max 64 characters")]),
});

export type UserFormValues = z.infer<typeof userCreateSchema>;
