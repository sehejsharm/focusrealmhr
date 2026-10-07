import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The onboarding handbooks are read at runtime from a path built at call
  // time, which the file tracer cannot follow — without this they are missing
  // from a serverless bundle and the handbook route 500s. The certificate
  // routes read the brand mark the same way.
  outputFileTracingIncludes: {
    "/api/onboarding/session/[token]/resource/[resourceId]": [
      "./content/onboarding/**/*",
    ],
    "/api/onboarding/offboarding/[code]/certificates/[kind]/pdf": [
      "./content/onboarding/brand/**/*",
    ],
    "/api/onboarding/admin/candidates/[id]/certificates/[kind]/pdf": [
      "./content/onboarding/brand/**/*",
    ],
  },

  /*
   * The module was called "onboarding" before it became Focus Realm HR, and
   * invitation links already sent out point at /onboarding/<code>. Those keep
   * working: every old address forwards to its /hr equivalent.
   */
  async redirects() {
    return [
      { source: "/onboarding", destination: "/hr", permanent: false },
      { source: "/onboarding/:path*", destination: "/hr/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
