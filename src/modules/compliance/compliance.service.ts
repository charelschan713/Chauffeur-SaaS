import { BadRequestException, Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class ComplianceService {
  private bucket = 'compliance-documents';

  async uploadDocument(tenant_id: string, entity_type: 'TENANT' | 'DRIVER' | 'VEHICLE', entity_id: string, document_type: string, file: any, expires_at?: string) {
    if (!file) throw new BadRequestException('file is required');
    const path = `${tenant_id}/${entity_type}/${entity_id}/${Date.now()}-${file.originalname}`;
    const { error: upErr } = await supabaseAdmin.storage.from(this.bucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (upErr) throw new BadRequestException(upErr.message);

    const { data, error } = await supabaseAdmin
      .from('compliance_documents')
      .insert({ tenant_id, entity_type, entity_id, document_type, file_url: path, file_name: file.originalname, expires_at: expires_at || null, status: 'PENDING' })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getDocuments(entity_type: string, entity_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('compliance_documents')
      .select('*')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getPendingReviews(status?: string, tenant_id?: string, document_type?: string) {
    let q = supabaseAdmin.from('compliance_documents').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status); else q = q.eq('status', 'PENDING');
    if (tenant_id) q = q.eq('tenant_id', tenant_id);
    if (document_type) q = q.eq('document_type', document_type);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    const out = await Promise.all((data ?? []).map(async (d: any) => {
      const signed = await supabaseAdmin.storage.from(this.bucket).createSignedUrl(d.file_url, 60 * 60);
      return { ...d, signed_url: signed.data?.signedUrl ?? null };
    }));
    return out;
  }

  async approveDocument(doc_id: string, reviewed_by: string) {
    const { data, error } = await supabaseAdmin
      .from('compliance_documents')
      .update({ status: 'APPROVED', reviewed_by, reviewed_at: new Date().toISOString(), rejection_reason: null, updated_at: new Date().toISOString() })
      .eq('id', doc_id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.refreshEntityStatus(data.tenant_id, data.entity_type, data.entity_id);
    return data;
  }

  async rejectDocument(doc_id: string, reviewed_by: string, rejection_reason: string) {
    const { data, error } = await supabaseAdmin
      .from('compliance_documents')
      .update({ status: 'REJECTED', reviewed_by, reviewed_at: new Date().toISOString(), rejection_reason, updated_at: new Date().toISOString() })
      .eq('id', doc_id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.refreshEntityStatus(data.tenant_id, data.entity_type, data.entity_id);
    return data;
  }

  async checkComplianceForTransfer(tenant_id: string) {
    const issues: string[] = [];
    const [tenant, drivers, vehicles] = await Promise.all([
      supabaseAdmin.from('tenants').select('compliance_status').eq('id', tenant_id).maybeSingle(),
      supabaseAdmin.from('drivers').select('id, compliance_status').eq('tenant_id', tenant_id),
      supabaseAdmin.from('tenant_vehicles').select('id, compliance_status').eq('tenant_id', tenant_id).eq('is_active', true),
    ]);
    if ((tenant.data as any)?.compliance_status !== 'APPROVED') issues.push('tenant compliance not approved');
    if ((drivers.data ?? []).some((d: any) => d.compliance_status !== 'APPROVED')) issues.push('drivers contain non-approved compliance');
    if ((vehicles.data ?? []).some((v: any) => v.compliance_status !== 'APPROVED')) issues.push('vehicles contain non-approved compliance');
    return { eligible: issues.length === 0, issues };
  }

  async expireDocuments() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin.from('compliance_documents').select('*').lt('expires_at', today).neq('status', 'EXPIRED');
    if (error) throw new BadRequestException(error.message);
    for (const d of data ?? []) {
      await supabaseAdmin.from('compliance_documents').update({ status: 'EXPIRED', updated_at: new Date().toISOString() }).eq('id', d.id);
      await this.refreshEntityStatus(d.tenant_id, d.entity_type, d.entity_id);
    }
    return { expired: (data ?? []).length };
  }

  async sendExpiryWarnings() {
    const today = new Date();
    const plus30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabaseAdmin
      .from('compliance_documents')
      .select('*')
      .gte('expires_at', today.toISOString().slice(0, 10))
      .lte('expires_at', plus30.toISOString().slice(0, 10));
    if (error) throw new BadRequestException(error.message);
    return { warning_count: (data ?? []).length };
  }

  async getStats() {
    const { data, error } = await supabaseAdmin.from('compliance_documents').select('status');
    if (error) throw new BadRequestException(error.message);
    const stats = { ALL: (data ?? []).length, PENDING: 0, APPROVED: 0, REJECTED: 0, EXPIRED: 0 } as any;
    for (const d of data ?? []) stats[d.status] = (stats[d.status] || 0) + 1;
    return stats;
  }

  private async refreshEntityStatus(tenant_id: string, entity_type: string, entity_id: string) {
    const { data } = await supabaseAdmin
      .from('compliance_documents')
      .select('status')
      .eq('tenant_id', tenant_id)
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id);

    let status = 'PENDING';
    const rows = data ?? [];
    if (rows.length > 0 && rows.every((r: any) => r.status === 'APPROVED')) status = 'APPROVED';
    else if (rows.some((r: any) => r.status === 'EXPIRED')) status = 'EXPIRED';
    else if (rows.some((r: any) => r.status === 'REJECTED')) status = 'SUSPENDED';

    if (entity_type === 'TENANT') await supabaseAdmin.from('tenants').update({ compliance_status: status }).eq('id', entity_id);
    if (entity_type === 'DRIVER') await supabaseAdmin.from('drivers').update({ compliance_status: status }).eq('id', entity_id);
    if (entity_type === 'VEHICLE') await supabaseAdmin.from('tenant_vehicles').update({ compliance_status: status }).eq('id', entity_id);
  }
}
