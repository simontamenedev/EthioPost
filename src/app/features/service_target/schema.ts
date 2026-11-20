import { z } from "zod";

const number = (min: number, max?: number) => {
  let s = z.number({ message: "Enter a number" }).min(min, `Min ${min}`);
  if (max !== undefined) s = s.max(max, `Max ${max}`);
  return s;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const targetSchema = z
  .object({
    name: z.string().trim().max(150),
    start_date: isoDate,
    end_date: isoDate,
    target_value: number(0),
    service_type_ids: z.array(z.string()).min(1, "Select at least one service type"),
    status: z.enum(["active", "inactive"]),
  })
  .refine((v) => v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "End date must be on or after start date",
  });
export type TargetFormValues = z.infer<typeof targetSchema>;