import { z } from "zod";

export const commissionRateSchema = z.object({
  service_name: z.string().trim().min(2, "Service name is required").max(150, "Max 150 characters"),
  rate: z
    .string()
    .trim()
    .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, "Enter a rate between 0 and 100"),
  service_types: z.string().trim().max(300, "Max 300 characters"),
  remark: z.string().trim().max(500, "Max 500 characters"),
  status: z.enum(["active", "inactive"]),
});

export type CommissionRateFormValues = z.infer<typeof commissionRateSchema>;