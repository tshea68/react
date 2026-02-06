import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  turbopack: {
    resolveAlias: {
      "@legacy": path.resolve(process.cwd(), "../src"),
    },
  },
};

export default nextConfig;
