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
  // The installed app's launch page and its worker (ROADMAP item 56): neither is kept by a
  // browser's or a server's cache, so that a release's launch page and worker, or the worker that
  // retires it, reach an installed app the next time it opens. The worker may fetch from this app
  // alone.
  headers: async () => [
    {
      source: '/launch',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
    {
      source: '/launch-worker.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'" },
      ],
    },
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
