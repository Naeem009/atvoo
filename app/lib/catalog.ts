import { cache } from "react";

export type CatalogMoney = {
  amount: string;
  currency: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  condition: "NEW" | "USED" | "REFURBISHED";
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  vendor: { name: string };
  price: CatalogMoney | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK";
  variants: Array<{
    id: string;
    price: CatalogMoney;
    stock: number;
    options: Record<string, string | number | boolean> | null;
  }>;
  images: Array<{ url: string; alt: string | null }>;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type CatalogBrand = {
  id: string;
  name: string;
  slug: string;
};

export type ProductPage = {
  data: CatalogProduct[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export class CatalogApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogApiError";
  }
}

export class CatalogNotFoundError extends CatalogApiError {
  constructor() {
    super("Product not found.", 404);
    this.name = "CatalogNotFoundError";
  }
}

export function getApiBaseUrl(): string {
  const configuredUrl =
    process.env.API_BASE_URL ?? "http://localhost:3001/api/v1";
  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new CatalogApiError("The catalog service is not configured.", 500);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new CatalogApiError("The catalog service URL is invalid.", 500);
  }

  return `${url.href.replace(/\/+$/, "")}/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new CatalogApiError(`Catalog response has an invalid ${field}.`, 502);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, field);
}

function parseMoney(value: unknown): CatalogMoney {
  if (!isRecord(value)) {
    throw new CatalogApiError("Catalog response has invalid pricing.", 502);
  }
  const amount = requiredString(value.amount, "price amount");
  const currency = requiredString(value.currency, "price currency");
  if (
    !/^\d+$/.test(amount) ||
    !Number.isSafeInteger(Number(amount)) ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new CatalogApiError("Catalog response has invalid pricing.", 502);
  }
  return { amount, currency };
}

function parseProduct(value: unknown): CatalogProduct {
  if (!isRecord(value)) {
    throw new CatalogApiError("Catalog response has an invalid product.", 502);
  }
  const category = value.category;
  const brand = value.brand;
  const vendor = value.vendor;
  const price = value.price;
  const variants = value.variants;
  const images = value.images;
  const availability = value.availability;
  const condition = value.condition;
  if (
    !isRecord(category) ||
    !isRecord(vendor) ||
    !Array.isArray(variants) ||
    !Array.isArray(images) ||
    (brand !== null && brand !== undefined && !isRecord(brand)) ||
    (price !== null && price !== undefined && !isRecord(price)) ||
    (availability !== "IN_STOCK" && availability !== "OUT_OF_STOCK") ||
    (condition !== "NEW" &&
      condition !== "USED" &&
      condition !== "REFURBISHED")
  ) {
    throw new CatalogApiError("Catalog response has an invalid product.", 502);
  }

  const parsedVariants = variants.map((variant) => {
    if (
      !isRecord(variant) ||
      typeof variant.stock !== "number" ||
      !Number.isSafeInteger(variant.stock) ||
      variant.stock < 0
    ) {
      throw new CatalogApiError(
        "Catalog response has an invalid product variant.",
        502,
      );
    }
    return {
      id: requiredString(variant.id, "variant id"),
      price: parseMoney(variant.price),
      stock: variant.stock,
      options: parseVariantOptions(variant.options),
    };
  });

  const parsedImages = images.map((image) => {
    if (!isRecord(image)) {
      throw new CatalogApiError("Catalog response has an invalid image.", 502);
    }
    const url = requiredString(image.url, "image URL");
    try {
      const imageUrl = new URL(url);
      if (!["http:", "https:"].includes(imageUrl.protocol)) throw new Error();
    } catch {
      throw new CatalogApiError("Catalog response has an invalid image URL.", 502);
    }
    return { url, alt: optionalString(image.alt, "image alt text") };
  });

  return {
    id: requiredString(value.id, "product id"),
    slug: requiredString(value.slug, "product slug"),
    title: requiredString(value.title, "product title"),
    description: optionalString(value.description, "product description"),
    condition,
    category: {
      name: requiredString(category.name, "category name"),
      slug: requiredString(category.slug, "category slug"),
    },
    brand:
      isRecord(brand)
        ? {
            name: requiredString(brand.name, "brand name"),
            slug: requiredString(brand.slug, "brand slug"),
          }
        : null,
    vendor: { name: requiredString(vendor.name, "vendor name") },
    price: isRecord(price) ? parseMoney(price) : null,
    availability,
    variants: parsedVariants,
    images: parsedImages,
  };
}

function parseVariantOptions(
  value: unknown,
): Record<string, string | number | boolean> | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) {
    throw new CatalogApiError(
      "Catalog response has invalid product options.",
      502,
    );
  }
  const options: Record<string, string | number | boolean> = {};
  for (const [name, option] of Object.entries(value)) {
    if (
      typeof option !== "string" &&
      typeof option !== "number" &&
      typeof option !== "boolean"
    ) {
      throw new CatalogApiError(
        "Catalog response has invalid product options.",
        502,
      );
    }
    options[name] = option;
  }
  return options;
}

async function requestJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(new URL(path, getApiBaseUrl()), {
      headers: { accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new CatalogApiError("The catalog service is unavailable.", 503);
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 404) throw new CatalogNotFoundError();
    throw new CatalogApiError(
      response.status >= 500
        ? "The catalog service is temporarily unavailable."
        : "The catalog request could not be completed.",
      response.status,
    );
  }

  return response.json();
}

export const getProductPage = cache(async (query: string): Promise<ProductPage> => {
  const payload = await requestJson(`products?${query}`);
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.data) ||
    !isRecord(payload.meta)
  ) {
    throw new CatalogApiError("Catalog response has an invalid page.", 502);
  }

  const { page, pageSize, total, totalPages } = payload.meta;
  if (
    !isSafeInteger(page) ||
    !isSafeInteger(pageSize) ||
    !isSafeInteger(total) ||
    !isSafeInteger(totalPages) ||
    page < 1 ||
    pageSize < 1 ||
    pageSize > 100 ||
    total < 0 ||
    totalPages < 0 ||
    payload.data.length > pageSize
  ) {
    throw new CatalogApiError("Catalog response has invalid pagination.", 502);
  }

  return {
    data: payload.data.map(parseProduct),
    meta: { page, pageSize, total, totalPages },
  };
});

export const getProduct = cache(async (slug: string): Promise<CatalogProduct> => {
  const payload = await requestJson(`products/${encodeURIComponent(slug)}`);
  if (!isRecord(payload) || !("data" in payload)) {
    throw new CatalogApiError("Catalog response has an invalid product.", 502);
  }
  return parseProduct(payload.data);
});

export const getCategories = cache(async (): Promise<CatalogCategory[]> => {
  const payload = await requestJson("categories");
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new CatalogApiError("Catalog response has invalid categories.", 502);
  }
  return payload.data.map((category) => {
    if (!isRecord(category)) {
      throw new CatalogApiError("Catalog response has an invalid category.", 502);
    }
    return {
      id: requiredString(category.id, "category id"),
      name: requiredString(category.name, "category name"),
      slug: requiredString(category.slug, "category slug"),
      description: optionalString(category.description, "category description"),
    };
  });
});

export const getBrands = cache(async (): Promise<CatalogBrand[]> => {
  const payload = await requestJson("brands");
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new CatalogApiError("Catalog response has invalid brands.", 502);
  }
  return payload.data.map((brand) => {
    if (!isRecord(brand)) {
      throw new CatalogApiError("Catalog response has an invalid brand.", 502);
    }
    return {
      id: requiredString(brand.id, "brand id"),
      name: requiredString(brand.name, "brand name"),
      slug: requiredString(brand.slug, "brand slug"),
    };
  });
});

export function formatCatalogPrice(price: CatalogMoney): string {
  const amount = Number(price.amount) / 100;
  if (!Number.isFinite(amount)) {
    throw new CatalogApiError("Catalog response has invalid pricing.", 502);
  }
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
