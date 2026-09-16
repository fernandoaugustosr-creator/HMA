/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: process.env.NEXT_DIST_DIR || '.next',

    // Otimizacao 4: Menor bundle (SWC minify + Strict Head) + Compressao HTTP GZIP/BROTLI
    swcMinify: true,
    compress: true,
    reactStrictMode: true,
    poweredByHeader: false,
    generateEtags: true,
    optimizeFonts: true,

    // Imagens: permitir dominios remotos (Supabase storage, etc)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'umvjzgurzkldqyxzkkaq.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
        formats: ['image/webp', 'image/avif'],
        minimumCacheTTL: 31536000,
    },

    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
    },
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        return [
            {
                source: '/@vite/client',
                destination: '/__hmr_stub/vite-client',
            },
        ]
    },

    experimental: {
        // Melhora renderizacao initial para paginas grandes (menor tempo first input)
        optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
    },
};

export default nextConfig;
