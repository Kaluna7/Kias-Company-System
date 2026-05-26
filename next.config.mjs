/** @type {import('next').NextConfig} */
const EVIDENCE_MAX_UPLOAD_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB

const nextConfig = {
  /** pdfjs-serverless is pre-bundled for Node; avoid worker resolution in .next chunks */
  serverExternalPackages: ["pdfjs-serverless"],
  /**
   * Prevent large multipart uploads (evidence ZIP/PDF/DOCX) from being cut by
   * the Next.js proxy — otherwise uploads fail with "No file" / network errors.
   */
  experimental: {
    proxyClientMaxBodySize: EVIDENCE_MAX_UPLOAD_BYTES,
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
