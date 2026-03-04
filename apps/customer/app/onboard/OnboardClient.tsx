'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? 'Request failed'); }
  return res.json();
}
async function post(path: string, body: object) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? 'Submission failed');
  return data;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-blue-700">{title}</h3>
      {children}
    </div>
  );
}

export function OnboardClient() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+61');
  const [phone, setPhone] = useState('');

  const [licenceNo, setLicenceNo] = useState('');
  const [licenceState, setLicenceState] = useState('NSW');
  const [licenceExpiry, setLicenceExpiry] = useState('');

  const [tfn, setTfn] = useState('');
  const [abn, setAbn] = useState('');

  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRel, setEmergencyRel] = useState('');

  // External only
  const [drivingRecordUrl, setDrivingRecordUrl] = useState('');
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');

  useEffect(() => {
    if (!token) { setLoadError('Invalid link — no token provided.'); return; }
    get(`/onboarding/invite/${token}`)
      .then((inv) => {
        setInvite(inv);
        // Pre-fill from invite
        if (inv.email) setEmail(inv.email);
        if (inv.phone_number) setPhone(inv.phone_number);
        if (inv.phone_country_code) setPhoneCountry(inv.phone_country_code);
        if (inv.display_name) {
          const parts = inv.display_name.split(' ');
          setFirstName(parts[0] ?? '');
          setLastName(parts.slice(1).join(' ') ?? '');
        }
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, string> = {
        first_name: firstName, last_name: lastName,
        email, phone_country_code: phoneCountry, phone_number: phone,
        licence_number: licenceNo, licence_state: licenceState, licence_expiry: licenceExpiry,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        emergency_contact_relationship: emergencyRel,
      };
      if (tfn) body.tax_file_number = tfn;
      if (abn) body.abn = abn;
      if (invite?.invite_type === 'EXTERNAL') {
        body.driving_record_url = drivingRecordUrl;
        body.criminal_record_url = criminalRecordUrl;
      }
      const result = await post(`/onboarding/submit/${token}`, body);
      setSubmitResult(result);
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md text-center">
        <div className="text-4xl mb-4">❌</div>
        <h2 className="font-bold text-gray-900 mb-2">Link Invalid</h2>
        <p className="text-sm text-gray-500">{loadError}</p>
      </div>
    </div>
  );

  if (!invite) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading your invitation...</div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-green-200 p-8 max-w-md text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {invite.invite_type === 'INTERNAL' ? 'Welcome aboard!' : 'Application Submitted!'}
        </h2>
        <p className="text-sm text-gray-600 mt-2">{submitResult?.message}</p>
        {invite.invite_type === 'INTERNAL' && (
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
            Download the <strong>{invite.company_name} Driver App</strong> and log in with your email and the password you set.
          </div>
        )}
      </div>
    </div>
  );

  const isExternal = invite.invite_type === 'EXTERNAL';
  const AU_STATES = ['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{invite.company_name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isExternal ? 'Partner Driver Registration' : 'Driver Registration'}
          </p>
        </div>

        {isExternal && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>External Driver Application</strong> — You will need to upload your driving record and criminal record check. Your application will be reviewed by the platform.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Personal Info */}
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" required>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="John" />
              </Field>
              <Field label="Last Name" required>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="Smith" />
              </Field>
            </div>
            <Field label="Email Address" required>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="john@example.com" />
            </Field>
            <Field label="Mobile Number" required>
              <div className="flex gap-2">
                <select value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+64">🇳🇿 +64</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                </select>
                <input required value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className={`${inputCls} flex-1`} placeholder="4xx xxx xxx" />
              </div>
            </Field>
          </Section>

          {/* Driver Licence */}
          <Section title="Driver Licence">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Licence Number" required>
                <input required value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} className={inputCls} placeholder="12345678" />
              </Field>
              <Field label="Issuing State" required>
                <select required value={licenceState} onChange={(e) => setLicenceState(e.target.value)}
                  className={inputCls}>
                  {AU_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Expiry Date" required>
              <input required type="date" value={licenceExpiry} onChange={(e) => setLicenceExpiry(e.target.value)} className={inputCls} />
            </Field>
          </Section>

          {/* Tax Information */}
          <Section title="Tax Information">
            <Field label="Tax File Number (TFN)">
              <input value={tfn} onChange={(e) => setTfn(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className={inputCls} placeholder="xxx xxx xxx" maxLength={9} />
            </Field>
            <Field label="ABN (if applicable)">
              <input value={abn} onChange={(e) => setAbn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className={inputCls} placeholder="xx xxx xxx xxx" maxLength={11} />
            </Field>
            <p className="text-xs text-gray-400">Your tax information is stored securely and only used for payment processing.</p>
          </Section>

          {/* Emergency Contact */}
          <Section title="Emergency Contact">
            <Field label="Full Name" required>
              <input required value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputCls} placeholder="Jane Smith" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone Number" required>
                <input required value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={inputCls} placeholder="+61 4xx xxx xxx" />
              </Field>
              <Field label="Relationship" required>
                <select required value={emergencyRel} onChange={(e) => setEmergencyRel(e.target.value)} className={inputCls}>
                  <option value="">Select...</option>
                  {['Spouse','Partner','Parent','Sibling','Friend','Other'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* External: Document Uploads */}
          {isExternal && (
            <Section title="Required Documents (External Drivers)">
              <p className="text-sm text-gray-500">Please upload your documents to a secure file host (e.g. Google Drive, Dropbox) and paste the public link below.</p>
              <Field label="Driving Record URL" required>
                <input required type="url" value={drivingRecordUrl} onChange={(e) => setDrivingRecordUrl(e.target.value)}
                  className={inputCls} placeholder="https://drive.google.com/..." />
              </Field>
              <Field label="Criminal Record Check URL" required>
                <input required type="url" value={criminalRecordUrl} onChange={(e) => setCriminalRecordUrl(e.target.value)}
                  className={inputCls} placeholder="https://drive.google.com/..." />
              </Field>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <strong>Documents required:</strong>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Driving record (from your state transport authority)</li>
                  <li>National Police Check (issued within 3 months)</li>
                </ul>
              </div>
            </Section>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{submitError}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : isExternal ? 'Submit Application →' : 'Complete Registration →'}
          </button>

          <p className="text-xs text-center text-gray-400">
            Your information is encrypted and stored securely by {invite.company_name}.
          </p>
        </form>
      </div>
    </div>
  );
}
