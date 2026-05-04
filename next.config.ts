import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client"],
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
