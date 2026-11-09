import { createCrudHooks } from "../../../lib/api/crud-hooks";
import type { Fsp, FspDetail, FspPayload } from "../../../lib/api/types";

const fsps = createCrudHooks<Fsp, FspPayload, Partial<FspPayload>, Record<never, never>, FspDetail>("fsps");

export const fspKeys = fsps.keys;
export const useFsps = fsps.useList;
export const useFsp = fsps.useOne;
export const useCreateFsp = fsps.useCreate;
export const useUpdateFsp = fsps.useUpdate;
export const useDeleteFsp = fsps.useDelete;