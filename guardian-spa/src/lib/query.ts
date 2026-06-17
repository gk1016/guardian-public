/**
 * TanStack Query client — single instance shared by the app.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s before refetch
      retry: 1,
      // Live updates arrive over the engine WebSocket; window-focus refetch
      // would re-pull every active query on each tab focus (redundant load).
      refetchOnWindowFocus: false,
    },
  },
});
