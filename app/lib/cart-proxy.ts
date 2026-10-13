import { cookies } from "next/headers";
import { getApiBaseUrl } from "@/app/lib/catalog";
import { isCartSessionId } from "@/app/lib/cart";

const cartCookieName = "cart_session";
const cartCookieTtlSeconds = 30 * 24 * 60 * 60;
const maxRequestBytes = 2048;

export async function proxyCartRequest(
  path: string,
  request: Request,
): Promise<Response> {
  const cookieStore = await cookies();
  const storedSession = cookieStore.get(cartCookieName)?.value;
  const sessionId =
    storedSession && isCartSessionId(storedSession) ? storedSession : undefined;
  const headers = new Headers({ accept: "application/json" });
  if (sessionId) headers.set("X-Cart-Session", sessionId);

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "DELETE") {
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      return errorResponse(415, "Send a JSON request body.");
    }
    const bodyResult = await readRequestBody(request);
    if ("response" in bodyResult) return bodyResult.response;
    body = bodyResult.body;
    headers.set("content-type", "application/json");
  }

  let upstream: Response;
  try {
    upstream = await fetch(new URL(path, getApiBaseUrl()), {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError")
    ) {
      return Response.json(
        {
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "The cart service is temporarily unavailable.",
          },
        },
        { status: 503 },
      );
    }
    throw error;
  }

  const upstreamSession = upstream.headers.get("x-cart-session");
  if (upstream.ok) {
    if (!upstreamSession || !isCartSessionId(upstreamSession)) {
      throw new Error("The cart service did not return a valid guest session.");
    }
    cookieStore.set(cartCookieName, upstreamSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cartCookieTtlSeconds,
    });
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  const requestId = upstream.headers.get("x-request-id");
  if (contentType) responseHeaders.set("content-type", contentType);
  if (requestId) responseHeaders.set("x-request-id", requestId);
  responseHeaders.set("cache-control", "private, no-store");
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function readRequestBody(
  request: Request,
): Promise<{ body: string } | { response: Response }> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return { response: errorResponse(413, "The cart request is too large.") };
  }

  const reader = request.body?.getReader();
  if (!reader) return { body: "" };
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxRequestBytes) {
      await reader.cancel();
      return { response: errorResponse(413, "The cart request is too large.") };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes) };
}

function errorResponse(status: number, message: string): Response {
  return Response.json(
    { error: { code: "VALIDATION_FAILED", message } },
    { status },
  );
}
