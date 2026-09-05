/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  
  typescript: {
    // Fail builds on type errors in CI/production; ignore only in dev for speed.
    ignoreBuildErrors: process.env.NODE_ENV !== "production",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV !== "production",
  },
  async redirects() {
    return [
      // /admin/sources was a pre-backend mock page; real source management
      // now lives at /admin/scraping. Keep old bookmarks/links working.
      {
        source: "/admin/sources",
        destination: "/admin/scraping",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
