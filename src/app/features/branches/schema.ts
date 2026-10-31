import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Max 150 characters"),
  description: z.string().trim().max(500, "Max 500 characters"),
  district_id: z.string().min(1, "Select a district"),
  status: z.enum(["active", "inactive"]),
});

export type BranchFormValues = z.infer<typeof branchSchema>;
