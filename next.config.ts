import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Scorecard photos are uploaded to a Server Action; the 1MB default is
      // far too small for a phone camera image (the extract path validates up
      // to 12MB), so raise the body limit to match.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
