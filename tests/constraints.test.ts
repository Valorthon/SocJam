import assert from "node:assert/strict";

import {
  getMediaRequirementMessage,
  hasRequiredMedia,
  PLATFORM_CONSTRAINTS,
  validatePost,
} from "../src/lib/platforms/constraints";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SIZE_MESSAGE,
} from "../src/lib/validations/upload";

const image = { type: "IMAGE" as const, mimeType: "image/jpeg", sizeBytes: 1024 };

const xOverLimit = validatePost("X", "x".repeat(281));
assert.equal(xOverLimit.valid, false);
assert.deepEqual(xOverLimit.errors, ["Over 280 character limit by 1"]);

assert.equal(getMediaRequirementMessage("INSTAGRAM"), "Instagram requires an image");
assert.equal(getMediaRequirementMessage("TIKTOK"), "TikTok requires a video");
assert.equal(getMediaRequirementMessage("X"), null);
assert.equal(getMediaRequirementMessage("X"), null);

assert.equal(hasRequiredMedia("INSTAGRAM", []), false);
assert.equal(hasRequiredMedia("INSTAGRAM", [image]), true);
assert.equal(hasRequiredMedia("TIKTOK", [image]), false);

const instagramWithoutImage = validatePost("INSTAGRAM", "A photo update");
assert.equal(instagramWithoutImage.valid, false);
assert.deepEqual(instagramWithoutImage.errors, ["Instagram requires an image"]);

const instagramWithImage = validatePost("INSTAGRAM", "A photo update", [image]);
assert.equal(instagramWithImage.valid, true);

const xWithFiveImages = validatePost(
  "X",
  "Too many images",
  Array.from({ length: 5 }, () => image),
);
assert.deepEqual(xWithFiveImages.errors, ["Maximum 4 images allowed on X"]);

const xWithUnsupportedMedia = validatePost("X", "Unsupported media", [
  { type: "IMAGE", mimeType: "image/webp", sizeBytes: 1024 },
]);
assert.deepEqual(xWithUnsupportedMedia.errors, ["X does not support image/webp"]);

const xWithOversizedMedia = validatePost("X", "Oversized media", [
  {
    type: "VIDEO",
    mimeType: "video/mp4",
    sizeBytes: MAX_UPLOAD_BYTES + 1,
  },
]);
assert.deepEqual(xWithOversizedMedia.errors, [
  MAX_UPLOAD_SIZE_MESSAGE,
]);

const xFileLimit = PLATFORM_CONSTRAINTS.X.maxFileSizeMB;
PLATFORM_CONSTRAINTS.X.maxFileSizeMB = 1;
try {
  const xWithPlatformOversizedMedia = validatePost("X", "Oversized media", [
    {
      type: "VIDEO",
      mimeType: "video/mp4",
      sizeBytes: 1024 * 1024 + 1,
    },
  ]);
  assert.deepEqual(xWithPlatformOversizedMedia.errors, [
    "File exceeds X size limit of 1 MB",
  ]);
} finally {
  PLATFORM_CONSTRAINTS.X.maxFileSizeMB = xFileLimit;
}

const tiktokWithVideo = validatePost("TIKTOK", "Video update", [
  { type: "VIDEO", mimeType: "video/mp4", sizeBytes: 1024 },
]);
assert.equal(tiktokWithVideo.valid, true);

const tiktokWithImage = validatePost("TIKTOK", "Image update", [image]);
assert.equal(tiktokWithImage.valid, false);
assert.deepEqual(tiktokWithImage.errors, [
  "TikTok requires a video",
  "Maximum 0 images allowed on TIKTOK",
  "TIKTOK does not support images",
  "TIKTOK does not support image/jpeg",
]);

console.log("Platform constraint tests passed.");
