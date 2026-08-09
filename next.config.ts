import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: [
    "headphones-richmond-conjunction-whole.trycloudflare.com",
  ],
};

export default nextConfig;
