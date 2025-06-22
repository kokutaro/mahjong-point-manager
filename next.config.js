/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone for custom server
  // output: 'standalone',
  images: {
    domains: ['localhost'],
  },
  
  // Performance optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Bundle analyzer (uncomment to analyze bundle size)
  // bundleAnalyzer: {
  //   enabled: process.env.ANALYZE === 'true',
  // },

  // Optimize CSS
  optimizeFonts: true,
  
  // Enable SWC minification for better performance
  swcMinify: true,
  
  // Optimize images
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400, // 24 hours
  },
  
  // Performance monitoring
  poweredByHeader: false,
  generateEtags: false,
  
  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Code splitting optimizations
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
          mantine: {
            test: /[\\/]node_modules[\\/]@mantine[\\/]/,
            name: 'mantine',
            priority: 20,
            reuseExistingChunk: true,
          },
          socket: {
            test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
            name: 'socket',
            priority: 15,
            reuseExistingChunk: true,
          },
        },
      }
    } else {
      // Server-side externals configuration
      config.externals = config.externals || []
      config.externals.push({
        'socket.io': 'commonjs socket.io',
        '@prisma/client': 'commonjs @prisma/client'
      })
    }
    
    return config
  },
  
  // Experimental features for server components
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ['socket.io', '@prisma/client'],
  },
}

module.exports = nextConfig