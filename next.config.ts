import type { NextConfig } from "next";

/*
 * On the single Focus Realm website the Workspace serves this app's pages under
 * /hr (see lib/onboarding/hub.server.ts). Our scripts and styles then live
 * under /hr-static so they never collide with the Workspace's own /_next.
 * Set at build time: with FOCUS_REALM_HUB_URL unset nothing changes.
 */
const onHub = Boolean(process.env.FOCUS_REALM_HUB_URL);

const nextConfig: NextConfig = {
  ...(onHub ? { assetPrefix: "/hr-static" } : {}),
  // The onboarding handbooks are read at runtime from a path built at call
  // time, which the file tracer cannot follow — without this they are missing
  // from a serverless bundle and the handbook route 500s. The certificate
  // routes read the logo the same way.
  outputFileTracingIncludes: {
    "/api/onboarding/session/[token]/resource/[resourceId]": [
      "./content/onboarding/**/*",
    ],
    "/api/onboarding/offboarding/[code]/certificates/[kind]/pdf": [
      "./content/onboarding/brand/*.png",
    ],
    "/api/onboarding/admin/candidates/[id]/certificates/[kind]/pdf": [
      "./content/onboarding/brand/*.png",
    ],
  },

  /*
   * The module was called "onboarding" before it became Focus Realm HR, and
   * invitation links already sent out point at /onboarding/<code>. Those keep
   * working: every old address forwards to its /hr equivalent.
   */
  async rewrites() {
    return onHub
      ? { beforeFiles: [{ source: "/hr-static/_next/:path+", destination: "/_next/:path+" }], afterFiles: [], fallback: [] }
      : { beforeFiles: [], afterFiles: [], fallback: [] };
  },

  async redirects() {
    return [
      { source: "/onboarding", destination: "/hr", permanent: false },
      { source: "/onboarding/:path*", destination: "/hr/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
