/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingExcludes: {
    "*": [
      "data/**",
      ".next/standalone/data/**"
    ]
  },
  allowedDevOrigins: ["10.189.154.93"]
};

export default nextConfig;
