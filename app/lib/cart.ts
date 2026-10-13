import { cookies } from "next/headers";
import { CatalogApiError, getApiBaseUrl } from "@/app/lib/catalog";
import { parseCartData, type CartData } from "@/app/lib/cart-contract";

const cartCookieName = "cart_session";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCartSessionId(value: string): boolean {
  return uuidPattern.test(value);
}

export async function getCurrentCart(): Promise<CartData | null> {
  const sessionId = (await cookies()).get(cartCookieName)?.value;
  if (!sessionId) return null;
  if (!isCartSessionId(sessionId)) {
    throw new CatalogApiError("The cart session is invalid.", 400);
  }

  let response: Response;
  try {
    response = await fetch(new URL("cart", getApiBaseUrl()), {
      headers: { accept: "application/json", "X-Cart-Session": sessionId },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "TimeoutError")
    ) {
      throw new CatalogApiError("The cart service is unavailable.", 503);
    }
    throw error;
  }
  if (!response.ok) {
    throw new CatalogApiError(
      "The cart could not be loaded. Please try again.",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CatalogApiError("The cart service returned an invalid response.", 502);
  }
  if (!isRecord(payload) || !("data" in payload)) {
    throw new CatalogApiError("The cart service returned an invalid response.", 502);
  }
  try {
    return parseCartData(payload.data);
  } catch (error) {
    if (error instanceof Error) {
      throw new CatalogApiError(error.message, 502);
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
