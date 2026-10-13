export type CartMoney = {
  amount: string;
  currency: string;
};

export type CartItem = {
  id: string;
  variantId: string;
  title: string;
  slug: string;
  vendor: string;
  category: string;
  quantity: number;
  stock: number;
  available: boolean;
  warnings: string[];
  price: CartMoney;
  previousPrice: CartMoney | null;
  lineTotal: CartMoney;
};

export type CartData = {
  items: CartItem[];
  itemCount: number;
  totals: CartMoney[];
  expiresAt: string;
};

export function parseCartData(value: unknown): CartData {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.totals)) {
    throw new Error("The cart service returned an invalid cart.");
  }
  const items = value.items.map(parseCartItem);
  const totals = value.totals.map(parseMoney);
  if (
    !Number.isSafeInteger(value.itemCount) ||
    Number(value.itemCount) !== items.reduce((sum, item) => sum + item.quantity, 0) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    throw new Error("The cart service returned invalid cart totals.");
  }
  return {
    items,
    itemCount: Number(value.itemCount),
    totals,
    expiresAt: value.expiresAt,
  };
}

function parseCartItem(value: unknown): CartItem {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.variantId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.vendor !== "string" ||
    typeof value.category !== "string" ||
    !Number.isSafeInteger(value.quantity) ||
    Number(value.quantity) < 1 ||
    !Number.isSafeInteger(value.stock) ||
    Number(value.stock) < 0 ||
    typeof value.available !== "boolean" ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === "string")
  ) {
    throw new Error("The cart service returned an invalid cart item.");
  }
  return {
    id: value.id,
    variantId: value.variantId,
    title: value.title,
    slug: value.slug,
    vendor: value.vendor,
    category: value.category,
    quantity: Number(value.quantity),
    stock: Number(value.stock),
    available: value.available,
    warnings: value.warnings,
    price: parseMoney(value.price),
    previousPrice:
      value.previousPrice === null ? null : parseMoney(value.previousPrice),
    lineTotal: parseMoney(value.lineTotal),
  };
}

function parseMoney(value: unknown): CartMoney {
  if (
    !isRecord(value) ||
    typeof value.amount !== "string" ||
    !/^\d+$/.test(value.amount) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency)
  ) {
    throw new Error("The cart service returned invalid price data.");
  }
  return { amount: value.amount, currency: value.currency };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
