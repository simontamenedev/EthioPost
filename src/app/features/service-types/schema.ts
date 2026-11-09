import { z } from "zod";

export const serviceTypeSchema = z.object({
  code: z.string().trim().min(2, "Min 2 characters").max(50),
  name: z.string().trim().min(2, "Min 2 characters").max(100),
  csv_label: z.string().trim().max(50),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
});
export type ServiceTypeFormValues = z.infer<typeof serviceTypeSchema>;