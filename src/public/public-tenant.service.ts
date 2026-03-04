import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

interface CachedEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class PublicTenantService {
  private readonly cache = new Map<string, CachedEntry<any>>();

  constructor(private readonly db: DataSource) {}

  private cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private cacheSet(key: string, data: any) {
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async resolveTenantBySlug(slug: string) {
    const cacheKey = `tenant:${slug}`;
    const cached = this.cacheGet<any>(cacheKey);
    if (cached) return cached;

    const [tenant] = await this.db.query(
      `SELECT id, name, slug, timezone, currency, status, custom_domain
       FROM public.tenants
       WHERE slug = $1 AND status = 'active'`,
      [slug],
    );
    if (!tenant) throw new NotFoundException(`Tenant not found: ${slug}`);
    this.cacheSet(cacheKey, tenant);
    return tenant;
  }

  async getTenantInfo(slug: string) {
    const tenant = await this.resolveTenantBySlug(slug);
    // Fetch logo/brand from integrations
    const [branding] = await this.db.query(
      `SELECT settings FROM public.integrations
       WHERE tenant_id = $1 AND type = 'BRANDING' AND active = true
       LIMIT 1`,
      [tenant.id],
    );
    const settings = branding?.settings ?? {};
    return {
      company_name: tenant.name,
      slug: tenant.slug,
      currency: tenant.currency,
      timezone: tenant.timezone,
      logo_url: settings.logo_url ?? null,
      primary_color: settings.primary_color ?? '#2563eb',
      cancel_window_hours: settings.cancel_window_hours ?? 24,
    };
  }

  async getServiceTypes(slug: string) {
    const tenant = await this.resolveTenantBySlug(slug);
    const cacheKey = `service-types:${tenant.id}`;
    const cached = this.cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db.query(
      `SELECT id, code, display_name AS name, calculation_type, booking_flow, active
       FROM public.tenant_service_types
       WHERE tenant_id = $1 AND active = true
       ORDER BY created_at ASC`,
      [tenant.id],
    );
    this.cacheSet(cacheKey, rows);
    return rows;
  }

  async getCarTypes(slug: string, serviceTypeId?: string) {
    const tenant = await this.resolveTenantBySlug(slug);
    const cacheKey = `car-types:${tenant.id}:${serviceTypeId ?? 'all'}`;
    const cached = this.cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db.query(
      `SELECT tsc.id, tsc.name, tsc.description, tsc.image_url,
              tsc.display_order, tsc.active, tsc.toll_enabled,
              tsc.base_fare_minor, tsc.minimum_fare_minor
       FROM public.tenant_service_classes tsc
       WHERE tsc.tenant_id = $1 AND tsc.active = true
       ORDER BY tsc.display_order ASC NULLS LAST, tsc.name ASC`,
      [tenant.id],
    );
    this.cacheSet(cacheKey, rows);
    return rows;
  }
}
