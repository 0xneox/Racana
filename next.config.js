const createNextIntlPlugin = require("next-intl/plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "bullmq", "ioredis"],
    // pdfjs-dist lazy-loads its worker module + CMap/standard_fonts data at
    // runtime; without this the files aren't traced into .next/standalone
    // and PDF text extraction fails in the deployed app.
    outputFileTracingIncludes: {
      "*": [
        "node_modules/pdfjs-dist/build/pdf.worker.mjs",
        "node_modules/pdfjs-dist/cmaps/**",
        "node_modules/pdfjs-dist/standard_fonts/**",
        "node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      ],
    },
  },
};

module.exports = createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
