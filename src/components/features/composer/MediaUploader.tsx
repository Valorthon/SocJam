"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, uploadMedia } from "@/lib/api";
import {
  isWithinUploadSizeLimit,
  MAX_UPLOAD_SIZE_MESSAGE,
} from "@/lib/validations/upload";
import type { ComposerMedia } from "@/stores/composerStore";

interface MediaUploaderProps {
  media: ComposerMedia[];
  onChange: (media: ComposerMedia[]) => void;
  onUploadingChange: (isUploading: boolean) => void;
}

const ACCEPTED_MEDIA_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

export function MediaUploader({
  media,
  onChange,
  onUploadingChange,
}: MediaUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function addFiles(files: FileList | null): Promise<void> {
    if (!files) {
      return;
    }

    const selectedFiles = Array.from(files);
    const acceptedFiles = selectedFiles.filter(
      (file) => ACCEPTED_MEDIA_TYPES.has(file.type) && isWithinUploadSizeLimit(file.size),
    );
    const hasOversizedFile = selectedFiles.some(
      (file) => !isWithinUploadSizeLimit(file.size),
    );
    const hasUnsupportedFile = selectedFiles.some(
      (file) => !ACCEPTED_MEDIA_TYPES.has(file.type),
    );
    setFileError(hasOversizedFile
      ? MAX_UPLOAD_SIZE_MESSAGE
      : hasUnsupportedFile
        ? "Use a supported image or video file."
        : null);

    if (acceptedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    onUploadingChange(true);
    try {
      const uploads = await Promise.all(acceptedFiles.map(uploadMedia));
      const additions = uploads.map<ComposerMedia>((upload) => ({
        id: crypto.randomUUID(),
        ...upload,
      }));
      onChange([...media, ...additions]);
    } catch (error) {
      setFileError(
        error instanceof ApiError
          ? error.message
          : "Unable to upload media. Please try again.",
      );
    } finally {
      setIsUploading(false);
      onUploadingChange(false);
    }
  }

  function removeMedia(mediaId: string): void {
    onChange(media.filter((item) => item.id !== mediaId));
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="media-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="media-heading" className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Media
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload images or video to include with your post. Platform requirements are checked before publishing.
          </p>
        </div>
        {fileError ? (
          <p className="w-full text-sm text-destructive" role="alert">
            {fileError}
          </p>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/webm"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
          <Upload className="mr-2" />
          {isUploading ? "Uploading…" : "Add media"}
        </Button>
      </div>

      {media.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ImagePlus className="size-4" />
          Choose images or video
        </button>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Selected media">
          {media.map((item) => (
            <li key={item.id} className="relative overflow-hidden rounded-md border border-border bg-background">
              {item.type === "VIDEO" ? (
                <video className="aspect-square w-full object-cover" src={item.url} muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded media previews use their API URL.
                <img className="aspect-square w-full object-cover" src={item.url} alt="Selected media preview" />
              )}
              <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{item.type.toLowerCase()}</span>
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeMedia(item.id)} aria-label="Remove media">
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
