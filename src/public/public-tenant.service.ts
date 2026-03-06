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
      `SELECT id, name, slug,
              COALESCE(timezone, default_timezone, 'Australia/Sydney') AS timezone,
              currency, status, custom_domain
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

    // Fetch branding — gracefully handle missing table/row
    let branding: any = null;
    let brandingError: string | null = null;
    try {
      const [row] = await this.db.query(
        `SELECT logo_url, primary_color, primary_foreground, font_family, cancel_window_hours
         FROM public.tenant_branding
         WHERE tenant_id = $1
         LIMIT 1`,
        [tenant.id],
      );
      branding = row ?? null;
    } catch (err: any) {
      brandingError = err?.message ?? 'unknown';
    }

    return {
      id: tenant.id,
      company_name: tenant.name,
      slug: tenant.slug,
      currency: tenant.currency ?? 'AUD',
      timezone: tenant.timezone ?? 'Australia/Sydney',
      logo_url: branding?.logo_url ?? null,
      primary_color: branding?.primary_color ?? null,
      primary_foreground: branding?.primary_foreground ?? null,
      font_family: branding?.font_family ?? null,
      cancel_window_hours: branding?.cancel_window_hours ?? 24,
      _debug_branding_error: brandingError,
    };
  }

  async getServiceTypes(slug: string) {
    const tenant = await this.resolveTenantBySlug(slug);
    const cacheKey = `service-types:${tenant.id}`;
    const cached = this.cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db.query(
      `SELECT id, code, display_name AS name, calculation_type, booking_flow, active,
              COALESCE(minimum_hours, 2)      AS minimum_hours,
              COALESCE(surge_multiplier, 1.0) AS surge_multiplier
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

    let rows: any[];
    try {
      rows = await this.db.query(
        `SELECT tsc.id, tsc.name, tsc.description, tsc.image_url,
                tsc.display_order, tsc.active,
                tsc.base_fare_minor, tsc.minimum_fare_minor,
                tsc.max_passengers, tsc.luggage_capacity, tsc.vehicle_class
         FROM public.tenant_service_classes tsc
         WHERE tsc.tenant_id = $1 AND tsc.active = true AND tsc.name IS NOT NULL AND tsc.name != ''
         ORDER BY tsc.display_order ASC NULLS LAST, tsc.name ASC`,
        [tenant.id],
      );
    } catch {
      // Fallback: migration may not have run yet — query without optional columns
      rows = await this.db.query(
        `SELECT tsc.id, tsc.name, tsc.description, tsc.image_url,
                tsc.display_order, tsc.active,
                tsc.base_fare_minor, tsc.minimum_fare_minor
         FROM public.tenant_service_classes tsc
         WHERE tsc.tenant_id = $1 AND tsc.active = true AND tsc.name IS NOT NULL AND tsc.name != ''
         ORDER BY tsc.display_order ASC NULLS LAST, tsc.name ASC`,
        [tenant.id],
      );
    }
    this.cacheSet(cacheKey, rows);
    return rows;
  }

  async getCities(slug: string) {
    const tenant = await this.resolveTenantBySlug(slug);
    const cacheKey = `cities:${tenant.id}`;
    const cached = this.cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db.query(
      `SELECT id, name, timezone, lat, lng, display_order
       FROM public.tenant_service_cities
       WHERE tenant_id = $1 AND active = true
       ORDER BY display_order ASC, name ASC`,
      [tenant.id],
    );
    this.cacheSet(cacheKey, rows);
    return rows;
  }

  /** Returns the first active auto-apply (no code) discount for widget banner */
  async getAutoDiscount(tenantSlug: string) {
    const tenant = await this.resolveTenant(tenantSlug);
    const [row] = await this.db.query(
      `SELECT name, discount_type, discount_value
       FROM public.tenant_discounts
       WHERE tenant_id = $1
         AND is_active = true
         AND (code IS NULL OR code = '')
         AND (valid_from IS NULL OR valid_from <= now())
         AND (valid_until IS NULL OR valid_until >= now())
       ORDER BY created_at ASC
       LIMIT 1`,
      [tenant.id],
    );
    return row ?? null;
  }
}
