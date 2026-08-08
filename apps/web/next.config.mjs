/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
