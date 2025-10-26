import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest} from "next/server";

const BUCKET_ID = "profile-avatars";
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ code, message, details }, { status });
}

async function ensureBucketExists() {
  const service = getServiceSupabaseClient();
  const { data } = await service.storage.getBucket(BUCKET_ID);
  if (data) {
    return service;
  }

  const { error } = await service.storage.createBucket(BUCKET_ID, {
    public: true,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  });

  if (error && error.message && !/Bucket already exists/i.test(error.message)) {
    throw error;
  }

  return service;
}

function resolveExtension(file: File): string {
  const lowerName = file.name.toLowerCase();
  const nameExt = lowerName.includes(".") ? lowerName.split(".").pop() : null;
  if (nameExt && nameExt.length <= 8 && /^[a-z0-9]+$/.test(nameExt)) {
    return nameExt;
  }
  return MIME_EXTENSION[file.type] ?? "bin";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[profile][avatar][post] auth resolution failed", authError.message);
      return jsonError(500, "AUTH_RESOLUTION_FAILED", "Unable to verify your session");
    }

    if (!user) {
      return jsonError(401, "UNAUTHENTICATED", "You must be signed in to upload an avatar");
    }

    let file: File | null = null;
    try {
      const formData = await req.formData();
      const candidate = formData.get("file");
      if (candidate instanceof File) {
        file = candidate;
      }
    } catch (cause) {
      console.error("[profile][avatar][post] failed to parse form data", cause);
      return jsonError(400, "INVALID_FORM_DATA", "Failed to read the uploaded file");
    }

    if (!file) {
      return jsonError(400, "FILE_REQUIRED", "Select an image to upload");
    }

    if (file.size === 0) {
      return jsonError(400, "EMPTY_FILE", "The selected file is empty");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return jsonError(400, "FILE_TOO_LARGE", "Images must be 2 MB or smaller");
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonError(400, "UNSUPPORTED_FILE", "Supported formats: JPEG, PNG, WEBP, SVG");
    }

    const service = await ensureBucketExists();

    const extension = resolveExtension(file);
    const cacheKey = Date.now().toString(36);
    const path = `${user.id}/${cacheKey}-${randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await service.storage.from(BUCKET_ID).upload(path, buffer, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

    if (uploadError) {
      console.error("[profile][avatar][post] upload failed", uploadError.message);
      return jsonError(500, "UPLOAD_FAILED", "We couldn’t store your image. Please try again.");
    }

    const { data: publicUrlData } = service.storage.from(BUCKET_ID).getPublicUrl(path);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return jsonError(500, "PUBLIC_URL_FAILED", "We couldn’t generate an image URL");
    }

    const cacheBustedUrl = `${publicUrl}?v=${cacheKey}`;

    return NextResponse.json({
      path,
      url: cacheBustedUrl,
      cacheKey,
    });
  } catch (error) {
    console.error("[profile][avatar][post] unexpected", error);
    return jsonError(500, "UNEXPECTED_ERROR", "We couldn’t upload your image. Please try again.");
  }
}

export const runtime = "nodejs";
