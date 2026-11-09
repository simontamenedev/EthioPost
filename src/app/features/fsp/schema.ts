import { z } from "zod";

export const fspSchema = z.object({
  code: z.string().trim().min(2, "Min 2 characters").max(30),
  name: z.string().trim().min(2, "Min 2 characters").max(100),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
});
export type FspFormValues = z.infer<typeof fspSchema>;