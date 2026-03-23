const API_BASE = import.meta.env.VITE_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

export async function fetchTenantInfo(slug: string) {
  const res = await fetch(`${API_BASE}/public/tenant-info?tenant_slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Tenant not found');
  return res.json();
}

export async function fetchServiceTypes(slug: string) {
  const res = await fetch(`${API_BASE}/public/service-types?tenant_slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Failed to load service types');
  return res.json();
}

export async function fetchCities(slug: string) {
  const res = await fetch(`${API_BASE}/public/cities?tenant_slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Failed to load cities');
  return res.json();
}

export async function fetchCarTypes(slug: string) {
  const res = await fetch(`${API_BASE}/public/car-types?tenant_slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Failed to load car types');
  return res.json();
}

export async function fetchRoute(slug: string, origin: string, destination: string, waypoints?: string[]) {
  const params = new URLSearchParams({ tenant_slug: slug, origin, destination });
  (waypoints ?? []).forEach((w) => params.append('waypoints', w));
  const res = await fetch(`${API_BASE}/public/maps/route?${params}`);
  if (!res.ok) throw new Error('Failed to calculate route');
  return res.json() as Promise<{ distance_km: number; duration_minutes: number }>;
}

export async function fetchQuote(slug: string, body: object) {
  const res = await fetch(
    `${API_BASE}/public/pricing/quote?tenant_slug=${encodeURIComponent(slug)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error('Failed to get quote');
  return res.json();
}
