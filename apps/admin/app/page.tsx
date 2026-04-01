export default function Page() {
  return (
    <main className="container">
      <div className="card">
        <span className="badge">API Console</span>
        <h1 style={{ marginTop: 12, marginBottom: 8 }}>Chauffeur Solutions — API & Integrations</h1>
        <p className="small">Central documentation and integration links for SaaS, tenant, and driver APIs.</p>
      </div>

      <div className="list" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>SaaS API Docs</h3>
          <p className="small">OpenAPI / Swagger for platform endpoints.</p>
          <a className="btn" href="https://chauffeur-saas-production.up.railway.app/api-docs" target="_blank" rel="noreferrer">Open SaaS API Docs</a>
        </div>

        <div className="card">
          <h3>Driver API Docs</h3>
          <p className="small">Driver app endpoints (same spec as SaaS docs).</p>
          <a className="btn" href="https://chauffeur-saas-production.up.railway.app/api-docs" target="_blank" rel="noreferrer">Open Driver API Docs</a>
        </div>

        <div className="card">
          <h3>Platform Vehicles (Public)</h3>
          <p className="small">Public platform vehicle list for tenant integrations.</p>
          <a className="btn" href="https://chauffeur-saas-production.up.railway.app/platform/vehicles/public" target="_blank" rel="noreferrer">View Platform Vehicle API</a>
        </div>

        <div className="card">
          <h3>Webhook Events</h3>
          <p className="small">Driver message → tenant webhook payloads.</p>
          <span className="btn">Coming soon</span>
        </div>
      </div>
    </main>
  );
}
