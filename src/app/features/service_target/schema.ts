import { z } from "zod";

// Numbers come from <input type="number"> via valueAsNumber (see EntityForm), so no coercion is needed.
const number = (min: number, max?: number) => {
  let s = z.number({ message: "Enter a number" }).min(min, `Min ${min}`);
  if (max !== undefined) s = s.max(max, `Max ${max}`);
  return s;
};

export const targetSchema = z.object({
  name: z.string().trim().max(150),
  year: number(2000, 2100).int("Must be a whole number"),
  target_value: number(0),
  service_type_ids: z.array(z.string()).min(1, "Select at least one service type"),
  status: z.enum(["active", "inactive"]),
});
export type TargetFormValues = z.infer<typeof targetSchema>;