import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Prevent double-mounting of socket connections in dev
  async rewrites() {
    return [
      {
        source: '/api/logo',
        destination: 'http://localhost:4000/api/logo',
      },
    ];
  },
};

export default nextConfig;
