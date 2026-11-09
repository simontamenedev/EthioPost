import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";


export type Fsp = { id: string; name: string };

/** Financial service providers (Telebirr, CBE, ...) shown as top-level folders. */
export function useFsps() {
  return useQuery<Fsp[], ApiError>({
    queryKey: ["fsps"],
    // Change this path to your providers endpoint.
    queryFn: ({ signal }) => api<Fsp[]>("/fsps", { signal }),
  });
}