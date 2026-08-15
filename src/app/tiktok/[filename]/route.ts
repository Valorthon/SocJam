import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const ALLOWED_FILE_NAME = "tiktokiJz4a8Oo1RaDbyIH2DEdDZFjHfdwDp7P.txt";

const paramsSchema = z.object({
  filename: z.literal(ALLOWED_FILE_NAME),
});

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } },
) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "tiktok",
    parsed.data.filename,
  );
  const content = await fs.readFile(filePath, "utf-8");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
