import { Buffer } from "node:buffer";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

type RequestImpl = typeof httpRequest;

type BustlyHttpRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const defaultHttpRequestImpl: RequestImpl = httpRequest;
const defaultHttpsRequestImpl: RequestImpl = httpsRequest;

let httpRequestImpl: RequestImpl = defaultHttpRequestImpl;
let httpsRequestImpl: RequestImpl = defaultHttpsRequestImpl;

export function setBustlyHttpDepsForTest(deps?: {
  httpRequest?: RequestImpl;
  httpsRequest?: RequestImpl;
}): void {
  httpRequestImpl = deps?.httpRequest ?? defaultHttpRequestImpl;
  httpsRequestImpl = deps?.httpsRequest ?? defaultHttpsRequestImpl;
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

async function resolveRequestBody(body: BodyInit | null | undefined): Promise<Buffer | null> {
  if (body == null) {
    return null;
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (body instanceof URLSearchParams) {
    return Buffer.from(body.toString());
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  throw new TypeError("Unsupported request body type for Bustly HTTP request");
}

function appendResponseHeaders(headers: Headers, rawHeaders: Record<string, string | string[] | undefined>): void {
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
      continue;
    }
    if (typeof value === "string") {
      headers.append(key, value);
    }
  }
}

export async function bustlyNodeRequest(
  input: string | URL,
  init: BustlyHttpRequestOptions = {},
): Promise<Response> {
  // Bustly desktop/gateway auth flows avoid Node's fetch/undici stack here so
  // FortiClient-style VPN environments stay on the simpler socket path.
  const url = typeof input === "string" ? new URL(input) : input;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol for Bustly HTTP request: ${url.protocol}`);
  }

  const bodyBuffer = await resolveRequestBody(init.body);
  const headers = new Headers(init.headers);
  if (bodyBuffer && !headers.has("content-length")) {
    headers.set("content-length", String(bodyBuffer.byteLength));
  }

  const controller = new AbortController();
  const timeoutMs =
    typeof init.timeoutMs === "number" && Number.isFinite(init.timeoutMs)
      ? Math.max(1_000, Math.floor(init.timeoutMs))
      : 30_000;
  const timeoutId = setTimeout(() => {
    controller.abort(createAbortError(`Bustly HTTP request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const externalSignal = init.signal;
  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason ?? createAbortError("Bustly HTTP request aborted"));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    return await new Promise<Response>((resolve, reject) => {
      const requestImpl = url.protocol === "https:" ? httpsRequestImpl : httpRequestImpl;
      const request = requestImpl(
        url,
        {
          method: init.method ?? "GET",
          headers: Object.fromEntries(headers.entries()),
          signal: controller.signal,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            const responseHeaders = new Headers();
            appendResponseHeaders(
              responseHeaders,
              response.headers as Record<string, string | string[] | undefined>,
            );
            resolve(
              new Response(Buffer.concat(chunks), {
                status: response.statusCode ?? 500,
                statusText: response.statusMessage ?? "",
                headers: responseHeaders,
              }),
            );
          });
          response.on("error", reject);
        },
      );

      request.on("error", (error) => {
        if (controller.signal.aborted) {
          const reason = controller.signal.reason;
          reject(reason instanceof Error ? reason : error);
          return;
        }
        reject(error);
      });

      if (bodyBuffer) {
        request.write(bodyBuffer);
      }
      request.end();
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
