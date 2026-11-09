import { z } from "zod";

const isNumber = (v: string) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0;
const optionalAmount = z.string().refine((v) => v.trim() === "" || isNumber(v), "Enter a valid amount");

export const commissionRuleSchema = z
  .object({
    fsp_id: z.string().min(1, "Select a provider"),
    service_type_id: z.string().min(1, "Select a service type"),
    qualifier: z.string().trim().max(100),
    min_amount: optionalAmount,
    max_amount: optionalAmount,
    commission_type: z.enum(["flat", "percent"]),
    basis: z.string(),
    rate: z.string().refine(isNumber, "Enter a valid rate"),
    conditions: z.string(),
    effective_from: z.string().min(1, "Required"),
    effective_to: z.string(),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((v, ctx) => {
    if (v.commission_type === "percent" && !v.basis)
      ctx.addIssue({ code: "custom", path: ["basis"], message: "Required for a percentage rate" });
    if (v.commission_type === "percent" && Number(v.rate) > 100)
      ctx.addIssue({ code: "custom", path: ["rate"], message: "Cannot exceed 100%" });
    if (v.min_amount && v.max_amount && Number(v.max_amount) < Number(v.min_amount))
      ctx.addIssue({ code: "custom", path: ["max_amount"], message: "Must be ≥ minimum" });
    if (v.effective_to && v.effective_to < v.effective_from)
      ctx.addIssue({ code: "custom", path: ["effective_to"], message: "Before start date" });
  });
export type CommissionRuleFormValues = z.infer<typeof commissionRuleSchema>;