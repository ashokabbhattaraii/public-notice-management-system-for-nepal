import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://suchanaai.tech"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in surfaces (settings live under /admin and /dashboard),
        // plus internal design pages. Nothing here belongs in a search result.
        disallow: [
          "/admin",
          "/dashboard",
          "/documents",
          "/login",
          "/api/",
          "/wireframes",
          "/demo",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
