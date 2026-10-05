import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The dice packages ship ES modules that import without file extensions, and sanitize-html's
  // HTML parser ships only ES modules; this also has Jest transform them.
  transpilePackages: [
    '@lambersond/3d-dice-core',
    '@lambersond/3d-dice-engine',
    '@lambersond/3d-dice-react',
    'htmlparser2',
    'domhandler',
    'domutils',
    'dom-serializer',
    'domelementtype',
    'entities',
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
