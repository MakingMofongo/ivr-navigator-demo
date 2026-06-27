/** @type {import('next').NextConfig} */

// On GitHub Pages the site is served from /<repo>/, so we need a basePath.
// Locally (dev / vercel) we serve from root, so basePath stays empty.
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "ivr-navigator-demo";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isPages ? `/${repo}` : "",
};

export default nextConfig;
