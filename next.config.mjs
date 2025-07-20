/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/portfolio',
  assetPrefix: '/portfolio/',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
