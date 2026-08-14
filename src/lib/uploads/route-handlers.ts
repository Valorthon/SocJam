import { NextResponse } from "next/server";

import type { getAuthenticatedUser } from "@/lib/auth";
import type { MediaStorage } from "@/lib/storage/types";
import {
  isWithinUploadSizeLimit,
  MAX_UPLOAD_SIZE_MESSAGE,
  uploadResponseSchema,
} from "@/lib/validations/upload";

const UPLOAD_FILE_NAME = /^[0-9a-f-]{36}\.(gif|jpg|png|webp|mp4|webm)$/;

function mediaTypeForMimeType(mimeType: string): "IMAGE" | "VIDEO" | null {
  const types: Record<string, "IMAGE" | "VIDEO"> = {
    "image/gif": "IMAGE",
    "image/jpeg": "IMAGE",
    "image/png": "IMAGE",
    "image/webp": "IMAGE",
    "video/mp4": "VIDEO",
    "video/webm": "VIDEO",
  };
  return types[mimeType] ?? null;
}

export interface UploadRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  storage: MediaStorage;
}

export function createUploadRouteHandlers(dependencies: UploadRouteDependencies) {
  async function POST(request: Request): Promise<NextResponse> {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Select a media file to upload." }, { status: 400 });
    }

    const type = mediaTypeForMimeType(file.type);
    if (!type) {
      return NextResponse.json({ error: "Only images and video are supported." }, { status: 400 });
    }

    if (!isWithinUploadSizeLimit(file.size)) {
      return NextResponse.json({ error: MAX_UPLOAD_SIZE_MESSAGE }, { status: 400 });
    }

    try {
      const saved = await dependencies.storage.save({
        bytes: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type,
      });
      return NextResponse.json(uploadResponseSchema.parse({
        media: {
          url: new URL(`/api/uploads/${saved.fileName}`, request.url).toString(),
          type,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      }), { status: 201 });
    } catch (error) {
      console.error("Unable to upload media.", error);
      return NextResponse.json({ error: "Unable to upload media." }, { status: 500 });
    }
  }

  async function GET(_request: Request, fileName: string): Promise<NextResponse> {
    if (!UPLOAD_FILE_NAME.test(fileName)) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    try {
      const media = await dependencies.storage.load(fileName);
      if (!media) {
        return NextResponse.json({ error: "Media not found." }, { status: 404 });
      }
      return new NextResponse(new Uint8Array(media.bytes).buffer, {
        headers: { "Content-Type": media.mimeType, "Cache-Control": "private, max-age=3600" },
      });
    } catch (error) {
      console.error("Unable to load media.", error);
      return NextResponse.json({ error: "Unable to load media." }, { status: 500 });
    }
  }

  return { POST, GET };
}
