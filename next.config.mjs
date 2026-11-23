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
};
export default nextConfig;
