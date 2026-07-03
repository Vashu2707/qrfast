import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  webpack: (config, { webpack, nextRuntime }) => {
    if (nextRuntime === "edge") {
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.version": JSON.stringify("v20.0.0"),
        })
      );
    }
    return config;
  },
};

export default nextConfig;
