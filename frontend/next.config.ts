import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Turbopack infers it from the nearest lockfile, and
  // an unrelated package-lock.json further up the filesystem makes it pick a
  // directory outside the repository — which it then warns about on every
  // build. `__dirname` is unavailable in an ESM config, so it is derived from
  // the module URL.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },

  typescript: {
    // Never ship a build that does not type-check. This is the default, and it
    // is stated explicitly so nobody flips it to unblock a deploy.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
