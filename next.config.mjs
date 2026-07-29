/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone server output so the Electron desktop build can ship a
  // self-contained Node server (.next/standalone/server.js).
  output: "standalone",
};

export default nextConfig;
