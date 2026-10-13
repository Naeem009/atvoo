import { HttpException, HttpStatus } from "@nestjs/common";
import { z } from "zod";

const integerQuery = (min: number, max: number, defaultValue?: number) => {
  const numberSchema =   z.preprocess(
    (value) =>
      typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(min).max(max),
  );
  return defaultValue === undefined
    ? numberSchema.optional()
    : numberSchema.default(defaultValue);
};

const slugQuery = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const catalogQuerySchema = z
  .object({
    page: integerQuery(1, 10_000, 1),
    pageSize: integerQuery(1, 100, 20),
    q: z.string().trim().min(2).max(100).optional(),
    category: slugQuery.optional(),
    brand: slugQuery.optional(),
    minPrice: integerQuery(0, Number.MAX_SAFE_INTEGER),
    maxPrice: integerQuery(0, Number.MAX_SAFE_INTEGER),
    availability: z.enum(["all", "in-stock"]).default("all"),
    sort: z
      .enum(["newest", "price-asc", "price-desc", "relevance"])
      .default("newest"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: "minPrice must not exceed maxPrice",
      });
    }
    if (!value.q && value.sort === "relevance") {
      context.addIssue({
        code: "custom",
        path: ["sort"],
        message: "relevance sorting requires a search query",
      });
    }
  });

export type CatalogQuery = {
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  availability: "all" | "in-stock";
  sort: "newest" | "price-asc" | "price-desc" | "relevance";
};

export function parseCatalogQuery(
  input: Record<string, unknown>,
): CatalogQuery {
  const result = catalogQuerySchema.safeParse(input);
  if (!result.success) {
    throw new HttpException(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "The catalog query is invalid.",
          details: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            issue: issue.message,
          })),
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  return {
    ...result.data,
    page: result.data.page ?? 1,
    pageSize: result.data.pageSize ?? 20,
  };
}
