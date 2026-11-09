import { createCrudHooks } from "../../../lib/api/crud-hooks";
import type { ServiceType, ServiceTypeDetail, ServiceTypePayload } from "../../../lib/api/types";

const serviceTypes = createCrudHooks<
  ServiceType, ServiceTypePayload, Partial<ServiceTypePayload>, Record<never, never>, ServiceTypeDetail
>("service-types");

export const serviceTypeKeys = serviceTypes.keys;
export const useServiceTypes = serviceTypes.useList;
export const useServiceType = serviceTypes.useOne;
export const useCreateServiceType = serviceTypes.useCreate;
export const useUpdateServiceType = serviceTypes.useUpdate;
export const useDeleteServiceType = serviceTypes.useDelete;