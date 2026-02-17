import { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin';

// Initialize Supabase client for sitemap generation
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://yestoryd.com'
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/assessment`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/book`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blogs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/coach/rucha`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // Dynamic blog posts from Supabase
  let blogPosts: MetadataRoute.Sitemap = []
  
  try {
    const supabase = createAdminClient()
    
    // Fetch published blog posts
    // Adjust table/column names based on your actual schema
    const { data: posts, error } = await (supabase as any)
      .from('blog_posts') // Change if your table name is different
      .select('slug, updated_at, created_at')
      .eq('is_published', true) // Change if you use different column name
      .order('created_at', { ascending: false })

    if (!error && posts) {
      blogPosts = posts.map((post: any) => ({
        url: `${baseUrl}/blogs/post/${post.slug}`,
        lastModified: new Date(post.updated_at || post.created_at),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }))
    }
  } catch (error) {
    // If blog fetch fails, continue with static pages only
    console.error('Error fetching blog posts for sitemap:', error)
  }

  // Combine static and dynamic pages
  return [...staticPages, ...blogPosts]
}
