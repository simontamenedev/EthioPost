import { z } from "zod";

export const agentSchema = z.object({
  parent_shortcode: z.string().trim().max(50, "Max 50 characters"),
  agent_shortcode: z.string().trim().min(1, "Shortcode is required").max(50, "Max 50 characters"),
  agent_name: z.string().trim().min(1, "Agent name is required").max(150, "Max 150 characters"),
  company_service_number: z.string().trim().max(50, "Max 50 characters"),
  remark: z.string().trim().max(1000, "Max 1000 characters"),
  district_id: z.string().min(1, "Select a district"),
  branch_id: z.string().min(1, "Select a branch"),
  status: z.enum(["active", "inactive"]),
});

export type AgentFormValues = z.infer<typeof agentSchema>;
