/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Ensure Turbopack uses this repo as the root even if there are other lockfiles
    // elsewhere on the machine (prevents incorrect workspace-root inference).
    root: process.cwd(),
  },
};

export default nextConfig;
