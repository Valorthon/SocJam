import { requestJson } from "@/lib/api/client";
import {
  uploadResponseSchema,
  type UploadResponse,
} from "@/lib/validations/upload";

export async function uploadMedia(file: File): Promise<UploadResponse["media"]> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await requestJson(
    "/api/uploads",
    { method: "POST", body: formData },
    uploadResponseSchema,
  );

  return response.media;
}
