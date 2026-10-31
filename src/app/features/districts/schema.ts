import { z } from "zod";

export const districtSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Max 150 characters"),
  description: z.string().trim().max(500, "Max 500 characters"),
  status: z.enum(["active", "inactive"]),
});

export type DistrictFormValues = z.infer<typeof districtSchema>;
