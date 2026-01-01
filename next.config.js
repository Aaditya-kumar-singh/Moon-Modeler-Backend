/** @type {import('next').NextConfig} */
const nextConfig = {
    // Optimize for faster startup in development
    experimental: {
        // Disable type checking during development for faster builds
        typedRoutes: false,
    },
    // Reduce compilation time
    swcMinify: true,
    // Only compile what's needed
    onDemandEntries: {
        maxInactiveAge: 25 * 1000,
        pagesBufferLength: 2,
    },
    // Disable source maps in development for faster builds
    productionBrowserSourceMaps: false,
}

module.exports = nextConfig
