import { HttpException, HttpStatus } from "@nestjs/common";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AddCartItemInput = {
  variantId: string;
  quantity: number;
};

export function parseCartSession(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && uuidPattern.test(value)) return value;
  throw validationError("X-Cart-Session must be a UUID.");
}

export function parseCartItemId(value: string): string {
  if (uuidPattern.test(value)) return value;
  throw validationError("The cart item ID must be a UUID.");
}

export function parseAddCartItem(value: unknown): AddCartItemInput {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["variantId", "quantity"].includes(key)) ||
    typeof value.variantId !== "string" ||
    !uuidPattern.test(value.variantId) ||
    !isQuantity(value.quantity)
  ) {
    throw validationError(
      "Provide a valid variantId and a quantity between 1 and 10.",
    );
  }
  return { variantId: value.variantId, quantity: value.quantity };
}

export function parseCartItemQuantity(value: unknown): number {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => key !== "quantity") ||
    !isQuantity(value.quantity)
  ) {
    throw validationError("Quantity must be an integer between 1 and 10.");
  }
  return value.quantity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuantity(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 10;
}

function validationError(message: string): HttpException {
  return new HttpException(
    { error: { code: "VALIDATION_FAILED", message } },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}
