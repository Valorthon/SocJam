import { promises as fs } from "fs";
import path from "path";

const FILE_NAME = "tiktokmX5fAgTqLBACKcxKOpbg69K2ywz3TjiP.txt";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "tiktok", FILE_NAME);
  const content = await fs.readFile(filePath, "utf-8");

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
