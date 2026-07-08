import type { QueryClient } from '@tanstack/react-query';

export function invalidateDashboard(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
}

export function invalidateAfterMutation(queryClient: QueryClient, keys: string[] = []) {
  const tasks = [invalidateDashboard(queryClient), ...keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))];
  return Promise.all(tasks);
}
