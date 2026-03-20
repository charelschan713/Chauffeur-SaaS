import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Widget } from './Widget';
import './styles.css';

function mount() {
  const container = document.getElementById('chauffeur-quote');
  if (!container) return;

  // Resolve tenant slug: querystring > data-tenant attribute
  let slug =
    new URLSearchParams(window.location.search).get('tenant') ??
    container.dataset.tenant ??
    '';

  // Also try script src querystring: <script src="...?tenant=slug">
  if (!slug) {
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="quote.js"]');
    scripts.forEach((s) => {
      const u = new URL(s.src, window.location.href);
      slug = u.searchParams.get('tenant') ?? slug;
    });
  }

  if (!slug) {
    container.innerHTML = '<p style="color:red">Quote widget: missing tenant slug</p>';
    return;
  }

  createRoot(container).render(
    <StrictMode>
      <Widget slug={slug} />
    </StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
