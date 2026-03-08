import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Allow Stripe iframes (js.stripe.com) — X-Frame-Options blocks them
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
              "connect-src 'self' https://api.stripe.com https://*.stripe.com https://stripe.com https://*.supabase.co https://chauffeur-saas-production.up.railway.app",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "worker-src blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
