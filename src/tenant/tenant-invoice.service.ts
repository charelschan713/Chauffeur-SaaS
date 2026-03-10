import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

// ── Readiness field lists ─────────────────────────────────────────────────────

/** Required company profile fields that must be non-empty to be invoice-ready */
const COMPANY_REQUIRED: Array<{ field: string; label: string }> = [
  { field: 'business_name',  label: 'Legal company name'   },
  { field: 'abn',            label: 'ABN'                   },
  { field: 'address_line1',  label: 'Address line 1'        },
  { field: 'city',           label: 'Suburb / City'         },
  { field: 'state',          label: 'State'                 },
  { field: 'postcode',       label: 'Postcode'              },
  { field: 'country',        label: 'Country'               },
  { field: 'email',          label: 'Accounts email'        },
  { field: 'phone',          label: 'Contact phone'         },
];

/** Required invoice profile fields */
const INVOICE_REQUIRED: Array<{ field: string; label: string }> = [
  { field: 'invoice_prefix',     label: 'Invoice prefix (e.g. INV)'         },
  { field: 'invoice_terms_days', label: 'Payment terms (days)'               },
  { field: 'currency',           label: 'Currency'                           },
  { field: 'timezone',           label: 'Timezone'                           },
];

// ─────────────────────────────────────────────────────────────────────────────

export interface CompanyReadiness {
  ready:   boolean;
  missing: string[];
}

export interface InvoiceProfileReadiness {
  ready:   boolean;
  missing: string[];
}

export interface PaymentReadiness {
  ready:   boolean;
  path:    'BANK' | 'PAYMENT_NOTE' | 'STRIPE' | null;
  missing: string[];
}

export interface InvoiceReadinessSummary {
  invoice_ready:      boolean;
  company_profile:    CompanyReadiness;
  invoice_profile:    InvoiceProfileReadiness;
  payment_instruction: PaymentReadiness;
}

@Injectable()
export class TenantInvoiceService implements OnModuleInit {
  constructor(private readonly db: DataSource) {}

  async onModuleInit() {
    // ── Company profile additions to tenants table ───────────────────────────
    await this.db.query(`
      ALTER TABLE public.tenants
        ADD COLUMN IF NOT EXISTS trading_name          TEXT,
        ADD COLUMN IF NOT EXISTS is_gst_registered     BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS accounts_contact_name TEXT,
        ADD COLUMN IF NOT EXISTS support_email         TEXT,
        ADD COLUMN IF NOT EXISTS company_profile_short TEXT;
    `).catch(() => {});

    // ── Tenant invoice profiles table ────────────────────────────────────────
    // Stores invoice-specific config only. Company identity comes from tenants table.
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_invoice_profiles (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL UNIQUE,

        -- Invoice numbering / config
        invoice_prefix           TEXT NOT NULL DEFAULT 'INV',
        invoice_terms_days       INT  NOT NULL DEFAULT 7,
        currency                 TEXT NOT NULL DEFAULT 'AUD',
        timezone                 TEXT,

        -- Payment instruction path (at least one required for readiness)
        payment_note             TEXT,           -- custom instruction (satisfies payment path C)
        stripe_invoice_enabled   BOOLEAN NOT NULL DEFAULT FALSE,  -- path B

        -- Display toggles (tenant controls; platform enforces template structure)
        invoice_header_title     TEXT,
        invoice_footer_note      TEXT,
        thank_you_message        TEXT,
        show_logo                BOOLEAN NOT NULL DEFAULT TRUE,
        show_legal_name          BOOLEAN NOT NULL DEFAULT TRUE,
        show_trading_name        BOOLEAN NOT NULL DEFAULT TRUE,
        show_abn                 BOOLEAN NOT NULL DEFAULT TRUE,
        show_company_profile     BOOLEAN NOT NULL DEFAULT FALSE,
        show_gst_breakdown       BOOLEAN NOT NULL DEFAULT TRUE,
        show_vehicle_details     BOOLEAN NOT NULL DEFAULT TRUE,
        show_booking_reference   BOOLEAN NOT NULL DEFAULT TRUE,
        show_payment_instructions BOOLEAN NOT NULL DEFAULT TRUE,
        show_footer_note         BOOLEAN NOT NULL DEFAULT TRUE,

        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch(() => {});
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getProfile(tenantId: string): Promise<Record<string, any>> {
    const rows = await this.db.query(
      `SELECT * FROM public.tenant_invoice_profiles WHERE tenant_id = $1`,
      [tenantId],
    );
    return rows[0] ?? { tenant_id: tenantId };   // return empty object if not yet configured
  }

  async getCompanyProfile(tenantId: string): Promise<Record<string, any>> {
    const rows = await this.db.query(
      `SELECT business_name, trading_name, abn, is_gst_registered,
              address_line1, address_line2, city, state, postcode, country,
              phone, email, website, logo_url,
              accounts_contact_name, support_email, company_profile_short,
              bank_name, bank_account_name, bank_bsb, bank_account_number,
              invoice_notes, invoice_footer
         FROM public.tenants WHERE id = $1`,
      [tenantId],
    );
    return rows[0] ?? {};
  }

  // ── Upsert invoice profile ────────────────────────────────────────────────

  async upsertProfile(tenantId: string, body: Record<string, any>): Promise<Record<string, any>> {
    const allowed = [
      'invoice_prefix','invoice_terms_days','currency','timezone',
      'payment_note','stripe_invoice_enabled',
      'invoice_header_title','invoice_footer_note','thank_you_message',
      'show_logo','show_legal_name','show_trading_name','show_abn',
      'show_company_profile','show_gst_breakdown','show_vehicle_details',
      'show_booking_reference','show_payment_instructions','show_footer_note',
    ];
    const sets: string[] = [];
    const params: any[] = [tenantId];
    let idx = 2;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(body[key]);
      }
    }
    if (sets.length === 0) return this.getProfile(tenantId);

    sets.push(`updated_at = NOW()`);

    const rows = await this.db.query(
      `INSERT INTO public.tenant_invoice_profiles (tenant_id, ${allowed.filter(k => body[k] !== undefined).join(', ')})
       VALUES ($1, ${allowed.filter(k => body[k] !== undefined).map((_,i) => `$${i+2}`).join(', ')})
       ON CONFLICT (tenant_id) DO UPDATE SET ${sets.join(', ')}
       RETURNING *`,
      params,
    );
    return rows[0];
  }

  // ── Readiness logic ───────────────────────────────────────────────────────

  checkCompanyProfile(tenant: Record<string, any>): CompanyReadiness {
    const missing: string[] = [];
    for (const { field, label } of COMPANY_REQUIRED) {
      const v = tenant[field];
      if (!v || (typeof v === 'string' && v.trim() === '')) missing.push(label);
    }
    return { ready: missing.length === 0, missing };
  }

  checkInvoiceProfile(profile: Record<string, any>): InvoiceProfileReadiness {
    const missing: string[] = [];
    for (const { field, label } of INVOICE_REQUIRED) {
      const v = profile[field];
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        missing.push(label);
      }
    }
    return { ready: missing.length === 0, missing };
  }

  checkPaymentInstructions(tenant: Record<string, any>, profile: Record<string, any>): PaymentReadiness {
    // Path A: bank transfer complete
    const bankReady =
      !!(tenant.bank_account_name?.trim()) &&
      !!(tenant.bank_bsb?.trim()) &&
      !!(tenant.bank_account_number?.trim());
    if (bankReady) return { ready: true, path: 'BANK', missing: [] };

    // Path B: Stripe invoice enabled
    if (profile.stripe_invoice_enabled === true) {
      return { ready: true, path: 'STRIPE', missing: [] };
    }

    // Path C: custom payment note provided
    if (profile.payment_note?.trim()) {
      return { ready: true, path: 'PAYMENT_NOTE', missing: [] };
    }

    return {
      ready: false,
      path: null,
      missing: [
        'At least one payment path required: bank transfer details (BSB + account) OR Stripe invoice enabled OR custom payment note',
      ],
    };
  }

  async checkReadiness(tenantId: string): Promise<InvoiceReadinessSummary> {
    const [tenant, profile] = await Promise.all([
      this.getCompanyProfile(tenantId),
      this.getProfile(tenantId),
    ]);

    const company   = this.checkCompanyProfile(tenant);
    const invoice   = this.checkInvoiceProfile(profile);
    const payment   = this.checkPaymentInstructions(tenant, profile);

    return {
      invoice_ready: company.ready && invoice.ready && payment.ready,
      company_profile:    company,
      invoice_profile:    invoice,
      payment_instruction: payment,
    };
  }
}
