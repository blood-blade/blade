
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: true, // Disable PWA for now
  register: false
});

const nextConfig: NextConfig = {
  /* config options here */
  // Set correct workspace root
  outputFileTracingRoot: __dirname,
  // Enable development optimizations
  reactStrictMode: true,
  crossOrigin: 'anonymous',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize compilation
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Optimize for development
  webpack: (config, { dev, isServer }) => {
    // Development optimizations
    if (dev) {
      // Optimize development build speed
      config.optimization = {
        ...config.optimization,
        runtimeChunk: false,
        minimize: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Combine all node_modules into a single chunk
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
  // Configure allowed dev origins for cross-origin requests (Next.js 15 requires exact origins)
  allowedDevOrigins: process.env.NODE_ENV === 'development' 
    ? [
        // Current Replit domain (dynamically determined)
        process.env.REPLIT_DOMAINS || '2b711deb-9881-4c8e-9864-f2078ec28923-00-1z7caopfvm8sp.picard.replit.dev',
        // Additional common Replit subdomains for compatibility
        'localhost:9000',
        '0.0.0.0:9000'
      ]
    : [],
  // Optimize for Vercel deployment
  output: process.env.VERCEL ? 'standalone' : undefined,
  // Replit environment configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: process.env.NODE_ENV === 'development' 
          ? [
              {
                key: 'Content-Security-Policy',
                value: `frame-ancestors ${process.env.REPLIT_DOMAINS || '2b711deb-9881-4c8e-9864-f2078ec28923-00-1z7caopfvm8sp.picard.replit.dev'} localhost:5000 0.0.0.0:5000;`,
              },
            ]
          : [
              {
                key: 'X-Frame-Options',
                value: 'SAMEORIGIN',
              },
            ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.staticneo.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.tenor.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
   env: {
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_TENOR_API_KEY: process.env.TENOR_API_KEY,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  },
};

export default withPWA(nextConfig);
