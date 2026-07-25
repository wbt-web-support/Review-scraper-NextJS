import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There are other package-lock.json files further up the tree, so Next infers the
  // workspace root as ../ and warns. Pin it to this project.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'webuildtrades.com',
      },
    ]
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/widget.js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=60',
          },
        ],
      },
      {
        // The video widget's bundle. Served to third-party sites, same as widget.js.
        source: '/w.js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *;",
          },
        ],
      },
      {
        source: '/api/public/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
  env: {
    WIDGET_DOMAIN: process.env.WIDGET_DOMAIN || process.env.VERCEL_URL || 'localhost:3000',
  },
  // `eslint` was removed from next.config in Next 16 -- lint no longer runs as part
  // of `next build`, so there is nothing left to opt out of. Run `npm run lint`.
  typescript: {
    ignoreBuildErrors: true
  },
};

export default nextConfig;