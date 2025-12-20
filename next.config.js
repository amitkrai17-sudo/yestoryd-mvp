/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Fix trailing slash redirect for webhooks
  skipTrailingSlashRedirect: true,
  
  // Image optimization settings
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google profile pictures
      'drive.google.com', // Google Drive images
    ],
  },
  
  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  },
  
  // Headers for security and CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;