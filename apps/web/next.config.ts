import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@avatarbook/shared", "@avatarbook/poa"],
};

export default nextConfig;
