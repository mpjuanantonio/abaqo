import { useQuery } from '@tanstack/react-query';

export interface HealthResponse {
  status: 'ok';
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const body = (await res.json()) as HealthResponse;
  if (body.status !== 'ok') throw new Error('Unexpected health payload');
  return body;
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
}
