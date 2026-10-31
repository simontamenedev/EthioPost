import { useMemo } from "react";
import { District, DistrictPayload } from "../../../lib/api/types";
import { createCrudHooks } from "../../../lib/api/crud-hooks";


const districts = createCrudHooks<District, DistrictPayload, Partial<DistrictPayload>>("districts");

export const districtKeys = districts.keys;
export const useDistricts = districts.useList;
export const useDistrict = districts.useOne;
export const useCreateDistrict = districts.useCreate;
export const useUpdateDistrict = districts.useUpdate;
export const useDeleteDistrict = districts.useDelete;

/** Every district (API max page = 200) as options + an id → name map, for selects and table cells. */
export function useDistrictLookup() {
  const query = useDistricts({ limit: 200 });
  return useMemo(() => {
    const rows = query.data ?? [];
    return {
      isLoading: query.isLoading,
      options: rows.map((d) => ({ value: d.id, label: d.name })),
      nameOf: (id: string) => rows.find((d) => d.id === id)?.name ?? "—",
    };
  }, [query.data, query.isLoading]);
}
