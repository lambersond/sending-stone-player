import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The dice packages ship ES modules that import without file extensions; this also has Jest
  // transform them.
  transpilePackages: [
    '@lambersond/3d-dice-core',
    '@lambersond/3d-dice-engine',
    '@lambersond/3d-dice-react',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**',
      },
    ],
  },
}

export default nextConfig
