/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Suppress Supabase realtime warnings
    config.ignoreWarnings = [
      {
        module: /@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ]
    return config
  },
}

export default nextConfig
