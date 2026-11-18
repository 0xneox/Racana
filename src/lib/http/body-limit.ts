export class RequestBodyTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`Request body exceeds the ${limitBytes}-byte limit.`);
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readBodyWithinLimit(
  request: Request,
  limitBytes: number
): Promise<ArrayBuffer> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > limitBytes) {
      throw new RequestBodyTooLargeError(limitBytes);
    }
  }

  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > limitBytes) {
        void reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError(limitBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(totalBytes);
  const bytes = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseFormDataWithinLimit(
  request: Request,
  limitBytes: number
): Promise<FormData> {
  const body = await readBodyWithinLimit(request, limitBytes);
  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  return boundedRequest.formData();
}
