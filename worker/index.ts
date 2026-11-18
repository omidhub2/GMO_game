import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { closeRequestDatabase, withDatabaseConnection } from "../src/lib/db-context";

type WorkerExecutionContext = { waitUntil(promise: Promise<unknown>): void };

interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE: { connectionString: string };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body)
            .transform(width > 0 ? { width } : {})
            .output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return withDatabaseConnection(env.HYPERDRIVE.connectionString, async () => {
      try {
        return await handler.fetch(request);
      } finally {
        // Close the request's Prisma pool after the response; don't make the
        // browser wait for socket teardown.
        ctx.waitUntil(closeRequestDatabase().catch(error => {
          console.error("[database] request client cleanup failed", error);
        }));
      }
    });
  },
};
