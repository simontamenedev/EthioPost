import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./client";
import type { ListParams } from "./types";

/**
 * Builds the full set of TanStack Query hooks for one REST resource.
 * `/{resource}` GET (list) · GET /{id} · POST · PATCH /{id} · DELETE /{id}
 */
export function createCrudHooks<
  TEntity extends { id: string },
  TCreate,
  TUpdate,
  TFilters extends object = Record<never, never>,
>(resource: string) {
  const keys = {
    all: [resource] as const,
    lists: () => [resource, "list"] as const,
    list: (params: object) => [resource, "list", params] as const,
    detail: (id: string) => [resource, "detail", id] as const,
  };

  function useList(params: ListParams & TFilters = {} as ListParams & TFilters, options?: { enabled?: boolean }) {
    return useQuery<TEntity[], ApiError>({
      queryKey: keys.list(params),
      queryFn: ({ signal }) => api<TEntity[]>(`/${resource}`, { query: params, signal }),
      placeholderData: keepPreviousData,
      enabled: options?.enabled ?? true,
    });
  }

  function useOne(id: string | undefined) {
    return useQuery<TEntity, ApiError>({
      queryKey: keys.detail(id ?? ""),
      queryFn: ({ signal }) => api<TEntity>(`/${resource}/${id}`, { signal }),
      enabled: Boolean(id),
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation<TEntity, ApiError, TCreate>({
      mutationFn: (payload) => api<TEntity>(`/${resource}`, { method: "POST", json: payload }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation<TEntity, ApiError, { id: string; data: TUpdate }>({
      mutationFn: ({ id, data }) => api<TEntity>(`/${resource}/${id}`, { method: "PATCH", json: data }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, string>({
      mutationFn: (id) => api<void>(`/${resource}/${id}`, { method: "DELETE" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
    });
  }

  return { keys, useList, useOne, useCreate, useUpdate, useDelete };
}
