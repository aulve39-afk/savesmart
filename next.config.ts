import type { NextConfig } from 'next'

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: isCapacitorBuild,
  },
}

export default nextConfig