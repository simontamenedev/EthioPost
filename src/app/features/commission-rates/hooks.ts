import { createCrudHooks } from "../../../lib/api/crud-hooks";
import { CommissionRate, CommissionRatePayload } from "../../../lib/api/types";

const rates = createCrudHooks<CommissionRate, CommissionRatePayload, Partial<CommissionRatePayload>>("commission-rates");

export const commissionRateKeys = rates.keys;
export const useCommissionRates = rates.useList;
export const useCommissionRate = rates.useOne;
export const useCreateCommissionRate = rates.useCreate;
export const useUpdateCommissionRate = rates.useUpdate;
export const useDeleteCommissionRate = rates.useDelete;