/**
 * Ambient types for the Cloudflare Workers runtime module.
 * Wrangler generates the concrete CloudflareEnv binding types separately.
 */
declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
}

interface CloudflareEnv {
  HYPERDRIVE: {
    connectionString: string;
  };
}
