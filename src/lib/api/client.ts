import { z } from "zod";

import { validationErrorSchema } from "@/lib/validations/common";

const UNKNOWN_ERROR_MESSAGE = "Unable to complete your request. Please try again.";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function fallbackErrorMessage(status: number): string {
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 404) {
    return "The requested resource could not be found.";
  }

  return UNKNOWN_ERROR_MESSAGE;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const parsed = validationErrorSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(parsed.data.error, status, parsed.data.fieldErrors);
  }

  const errorBody = z.object({ error: z.string().min(1) }).safeParse(body);
  if (errorBody.success) {
    return new ApiError(errorBody.data.error, status);
  }

  return new ApiError(fallbackErrorMessage(status), status);
}

export async function requestJson<T>(
  path: string,
  init: RequestInit,
  responseSchema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Unable to reach OmniPost. Check your connection and try again.",
      0,
    );
  }

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw toApiError(response.status, body);
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(UNKNOWN_ERROR_MESSAGE, response.status);
  }

  return parsed.data;
}

export async function requestNoContent(
  path: string,
  init: RequestInit,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Unable to reach OmniPost. Check your connection and try again.",
      0,
    );
  }

  if (!response.ok) {
    throw toApiError(response.status, await parseResponseBody(response));
  }
}
