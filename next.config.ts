import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { cpus: 1 },
  webpack: (config, { dev }) => {
    if (dev) config.parallelism = 1;
    return config;
  },
};

export default nextConfig;
