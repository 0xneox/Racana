/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "bullmq", "ioredis"],
    // pdf-parse (pdfjs-dist) lazy-loads its worker module at runtime; without
    // this the file is not traced into .next/standalone and PDF QA fails.
    outputFileTracingIncludes: {
      "*": [
        "node_modules/pdfjs-dist/build/pdf.worker.mjs",
        "node_modules/pdf-parse/**",
      ],
    },
  },
};

module.exports = nextConfig;
