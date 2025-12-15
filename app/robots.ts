import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://yestoryd.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/parent/',      // Parent dashboard - private
          '/coach/dashboard/', // Coach dashboard - private
          '/admin/',       // Admin panel - private
          '/api/',         // API routes
          '/assessment/results/', // Individual results - private
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
