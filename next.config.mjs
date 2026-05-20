/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /**
     * Prevent large multipart uploads (evidence ZIP/PDF/DOCX) from being cut by
     * Next.js dev proxy, which appears in UI as generic "network error".
     */
    proxyClientMaxBodySize: 8 * 1024 * 1024 * 1024, // 8 GB
  },
  turbopack: {
    // Ensure Turbopack uses this repo as the root even if there are other lockfiles
    // elsewhere on the machine (prevents incorrect workspace-root inference).
    root: process.cwd(),
  },
  // Allow dev server to be accessed via ngrok tunnel (untuk akses dari HP) dan local network
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "192.168.146.1"],
};

export default nextConfig;
