/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Phones must always check for a new service worker.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  // The owner, billing and Paystack folders sit one level deeper on GitHub
  // (app/owner/owner, app/(app)/billing/billing, app/api/paystack/paystack).
  // These rewrites serve them at their proper addresses: /owner, /billing, /api/paystack/webhook.
  // They only apply where no page exists at the address itself.
  async rewrites() {
    return [
      { source: '/owner/:path*', destination: '/owner/owner/:path*' },
      { source: '/billing/:path*', destination: '/billing/billing/:path*' },
      { source: '/api/paystack/:path*', destination: '/api/paystack/paystack/:path*' },
    ];
  },
};
export default nextConfig;
