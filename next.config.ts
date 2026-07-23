import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',  // required for ukraine.com.ua Node.js Selector + Phusion Passenger deploy
};

export default nextConfig;
