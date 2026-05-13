'use client';

import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link target: obra hub lives on `index` with tabs; first tab is dashboard. */
export default function DashboardRedirect() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  if (!id) return null;
  return <Redirect href={`/(main)/obra/${id}`} />;
}
