import { createCrudHooks } from "../../../lib/api/crud-hooks";
import type {
  CommissionRule, CommissionRuleDetail, CommissionRuleFilters, CommissionRulePayload,
} from "../../../lib/api/types";

const rules = createCrudHooks<
  CommissionRule, CommissionRulePayload, Partial<CommissionRulePayload>, CommissionRuleFilters, CommissionRuleDetail
>("commission-rules");

export const commissionRuleKeys = rules.keys;
export const useCommissionRules = rules.useList;
export const useCommissionRule = rules.useOne;
export const useCreateCommissionRule = rules.useCreate;
export const useUpdateCommissionRule = rules.useUpdate;
export const useDeleteCommissionRule = rules.useDelete;