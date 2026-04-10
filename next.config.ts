import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // =====================================================
  // REACT STRICT MODE
  // =====================================================
  reactStrictMode: true,
  
  // =====================================================
  // IMAGES OPTIMIZATION
  // =====================================================
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // =====================================================
  // COMPRESSION
  // =====================================================
  compress: true,
  
  // =====================================================
  // POWERED BY HEADER
  // =====================================================
  poweredByHeader: false,
  
  // =====================================================
  // PRODUCTION CONSOLE LOGS
  // =====================================================
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // =====================================================
  // SECURITY HEADERS
  // =====================================================
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
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        source: '/dashboard/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
  
  // =====================================================
  // ENVIRONMENT VARIABLES
  // =====================================================
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://monjez.com',
    NEXT_PUBLIC_FB_PAGE_ID: process.env.NEXT_PUBLIC_FB_PAGE_ID || '',
  },
  
  // =====================================================
  // REDIRECTS
  // =====================================================
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
  
  // =====================================================
  // TRAILING SLASH
  // =====================================================
  trailingSlash: false,
  
  // =====================================================
  // OUTPUT
  // =====================================================
  output: 'standalone',
  
  // =====================================================
  // TURBOPACK CONFIG (Required for Next.js 16)
  // =====================================================
  turbopack: {
    // Empty config to silence the warning
  },
  
  // =====================================================
  // EXPERIMENTAL FEATURES
  // =====================================================
  experimental: {
    optimizePackageImports: ['@prisma/client', 'openai'],
  },
};

export default nextConfig;