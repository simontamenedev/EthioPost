import { z } from "zod";

export const districtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  parent_id: z.string().optional().default(""),
  status: z.enum(["active", "inactive"]),
});

export type DistrictFormValues = z.infer<typeof districtSchema>;