"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCatalogQuery = parseCatalogQuery;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const integerQuery = (min, max, defaultValue) => {
    const numberSchema = zod_1.z.preprocess((value) => typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : value, zod_1.z.number().int().min(min).max(max));
    return defaultValue === undefined
        ? numberSchema.optional()
        : numberSchema.default(defaultValue);
};
const slugQuery = zod_1.z
    .string()
    .trim()
    .min(1)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const catalogQuerySchema = zod_1.z
    .object({
    page: integerQuery(1, 10_000, 1),
    pageSize: integerQuery(1, 100, 20),
    q: zod_1.z.string().trim().min(2).max(100).optional(),
    category: slugQuery.optional(),
    brand: slugQuery.optional(),
    minPrice: integerQuery(0, Number.MAX_SAFE_INTEGER),
    maxPrice: integerQuery(0, Number.MAX_SAFE_INTEGER),
    availability: zod_1.z.enum(["all", "in-stock"]).default("all"),
    sort: zod_1.z
        .enum(["newest", "price-asc", "price-desc", "relevance"])
        .default("newest"),
})
    .strict()
    .superRefine((value, context) => {
    if (value.minPrice !== undefined &&
        value.maxPrice !== undefined &&
        value.minPrice > value.maxPrice) {
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
function parseCatalogQuery(input) {
    const result = catalogQuerySchema.safeParse(input);
    if (!result.success) {
        throw new common_1.HttpException({
            error: {
                code: "VALIDATION_FAILED",
                message: "The catalog query is invalid.",
                details: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    issue: issue.message,
                })),
            },
        }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return {
        ...result.data,
        page: result.data.page ?? 1,
        pageSize: result.data.pageSize ?? 20,
    };
}
//# sourceMappingURL=catalog-query.js.map