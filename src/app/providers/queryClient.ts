import { QueryClient } from '@tanstack/react-query'

export const ONE_DAY = 1000 * 60 * 60 * 24

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // gcTime must be ≥ the persister maxAge (QueryProvider) or entries get evicted before
      // the persister rehydrates them.
      gcTime: ONE_DAY,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
