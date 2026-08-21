import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

export function QueryState({
  query,
  loading,
  errorTitle = 'Unable to load this view',
  empty,
  children
}) {
  if (query.isLoading) {
    return loading;
  }

  if (query.isError) {
    return (
      <ErrorState
        title={errorTitle}
        description={query.error?.message ?? 'Please try again in a moment.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  if (!query.data && empty) {
    return empty;
  }

  if (empty && Array.isArray(query.data) && query.data.length === 0) {
    return empty;
  }

  if (empty && query.data?.items?.length === 0) {
    return empty;
  }

  return children;
}

export function DefaultEmptyState({ title, description }) {
  return <EmptyState title={title} description={description} />;
}
