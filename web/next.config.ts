import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The same site was also reachable at llm-eval-harness-eight.vercel.app, which splits search signals
  // between two addresses. Send that address to evalgate-ak.vercel.app permanently, keeping the page path.
  // Only that exact hostname matches, so preview deployments are not affected.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "llm-eval-harness-eight\\.vercel\\.app" }],
        destination: "https://evalgate-ak.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
