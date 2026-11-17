import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

const require = createRequire(import.meta.url);

function prismaClientResolve(): Plugin {
  return {
    name: "prisma-client-resolve",
    enforce: "pre",
    resolveId(source) {
      if (source !== ".prisma/client/default") return null;

      try {
        return require.resolve(".prisma/client/default");
      } catch {
        this.error(
          'Prisma Client is not generated. Run "npx prisma generate" before building the Cloudflare Worker.',
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    prismaClientResolve(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  ssr: {
    noExternal: ["@prisma/client"],
  },
});
