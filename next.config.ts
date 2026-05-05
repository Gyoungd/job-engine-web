import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.8.128'],
  outputFileTracingIncludes: {
    '/api/generate-resume': ['./profile/*.md'],
  },
};

export default nextConfig;
