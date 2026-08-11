import type { NextConfig } from "next";

/**
 * Hostnames this admin panel is served from, comma-separated.
 *
 * More than one because production and the AWS staging host run side by side
 * during the migration. Behind a CDN the request's Host header is the origin's
 * internal name rather than any of these — see `allowedOrigins`.
 *
 * Baked in at build time, so a host added here needs a rebuild, not a restart.
 */
const SITE_HOSTS = (process.env.SITE_HOSTS || "admin.aceglobal.ai,admin.aws.aceglobal.ai")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Emit a self-contained .next/standalone/server.js with only the modules the
  // app actually reaches. Without it a container image has to carry the whole
  // node_modules tree.
  output: "standalone",

  experimental: {
    serverActions: {
      // Next rejects a Server Action whose Origin doesn't match the Host, as a
      // CSRF defence. Behind a CDN those legitimately differ — Origin is the
      // public hostname, Host is whatever the CDN forwards to — so without this
      // EVERY action in the app fails with "Invalid Server Actions request".
      // It passes in dev and over curl and breaks only once a CDN is in front,
      // which is exactly the change being planned.
      allowedOrigins: SITE_HOSTS,

      // Default is 1MB. Documents no longer travel through an action — the
      // browser uploads to Supabase Storage directly and the action receives
      // only the resulting path — so this needs to cover form fields, nothing
      // more. Keeping it small bounds what an action will parse.
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
