/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tr.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't0.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't1.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't2.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't3.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't4.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't5.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't6.rbxcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't7.rbxcdn.com',
        pathname: '/**',
      }
    ],
  },
  
  // SEO & Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
