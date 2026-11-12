import { QueryClient, queryOptions } from '@tanstack/react-query';
import { currentUser } from './session';

export const queryClient = new QueryClient();
export const sessionOptions = queryOptions({
  queryKey: ['session'],
  queryFn: currentUser,
  retry: false,
  staleTime: 30_000,
});
