import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ProductCondition, ProductStatus, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type { CatalogQuery } from "./catalog-query";

const productInclude = {
  vendor: { select: { displayName: true } },
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true, slug: true } },
  variants: {
    where: { status: "ACTIVE" as const, deletedAt: null },
    orderBy: { price: "asc" as const },
  },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }],
    select: {
      storagePath: true,
      altText: true,
      mimeType: true,
      width: true,
      height: true,
      isPrimary: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type SearchRow = { id: string | null; total: bigint };

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listProducts(query: CatalogQuery) {
    try {
      const where = this.publicProductWhere(query);
      let products: ProductRecord[];
      let total: number;

      if (query.q) {
        const ids = await this.searchProductIds(query);
        total = Number(ids[0]?.total ?? 0n);
        const productIds = ids.flatMap((row) => (row.id ? [row.id] : []));
        products = await this.loadProducts(productIds);
        const order = new Map(productIds.map((id, index) => [id, index]));
        products.sort(
          (left, right) =>
            (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
        );
      } else if (query.sort === "price-asc" || query.sort === "price-desc") {
        const ids = await this.priceSortedProductIds(query);
        total = Number(ids[0]?.total ?? 0n);
        const productIds = ids.flatMap((row) => (row.id ? [row.id] : []));
        products = await this.loadProducts(productIds);
        const order = new Map(productIds.map((id, index) => [id, index]));
        products.sort(
          (left, right) =>
            (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
        );
      } else {
        const [records, count] = await this.prisma.$transaction([
          this.prisma.product.findMany({
            where,
            include: productInclude,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.product.count({ where }),
        ]);
        products = records;
        total = count;
      }

      return {
          data: products.map((product) => this.serializeProduct(product, query)),
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    } catch (error) {
      this.handleDatabaseError(error, "Could not load the product catalog.");
    }
  }

  async getProduct(idOrSlug: string) {
    if (idOrSlug.length > 180) {
      throw new NotFoundException({
        error: { code: "NOT_FOUND", message: "Product not found." },
      });
    }

    const where = this.publicProductWhere({});
    let product: ProductRecord | null;
    try {
      product = await this.prisma.product.findFirst({
        where: {
          AND: [
            where,
            {
              OR: [
                { slug: idOrSlug },
                ...(this.isUuid(idOrSlug) ? [{ id: idOrSlug }] : []),
              ],
            },
          ],
        },
        include: productInclude,
      });
    } catch (error) {
      this.handleDatabaseError(error, "Could not load the requested product.");
    }

    if (!product) {
      throw new NotFoundException({
        error: { code: "NOT_FOUND", message: "Product not found." },
      });
    }
    return { data: this.serializeProduct(product) };
  }

  async listCategories() {
    try {
      return {
        data: await this.prisma.category.findMany({
          where: { isActive: true },
          select: {
            id: true,
            parentId: true,
            name: true,
            slug: true,
            description: true,
            displayOrder: true,
            _count: {
              select: {
                products: {
                  where: this.publicProductWhere({}),
                },
              },
            },
          },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        }),
      };
    } catch (error) {
      this.handleDatabaseError(error, "Could not load catalog categories.");
    }
  }

  async listBrands() {
    try {
      return {
        data: await this.prisma.brand.findMany({
          where: {
            isActive: true,
            products: { some: this.publicProductWhere({}) },
          },
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
        }),
      };
    } catch (error) {
      this.handleDatabaseError(error, "Could not load catalog brands.");
    }
  }

  createEtag(data: unknown): string {
    return `"${createHash("sha256").update(JSON.stringify(data)).digest("hex")}"`;
  }

  private async searchProductIds(query: CatalogQuery): Promise<SearchRow[]> {
    const conditions = this.rawPublicConditions(query);
    const searchText = query.q ?? "";
    const offset = (query.page - 1) * query.pageSize;
    const orderBy =
      query.sort === "price-asc"
        ? Prisma.raw("lowest_price ASC")
        : query.sort === "price-desc"
          ? Prisma.raw("lowest_price DESC")
          : query.sort === "newest"
            ? Prisma.raw("created_at DESC")
            : Prisma.raw("relevance DESC");
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${searchText}) AS tsquery
      ),
      matching_products AS (
        SELECT p.id,
          max(ts_rank_cd(p.search_document, search_query.tsquery)) AS relevance,
          min(variant.price) AS lowest_price,
          p.created_at
        FROM public.products AS p
        JOIN public.vendors AS vendor ON vendor.id = p.vendor_id
        JOIN public.categories AS category ON category.id = p.category_id
        JOIN public.brands AS brand ON brand.id = p.brand_id
        JOIN public.product_variants AS variant
          ON variant.product_id = p.id
          AND ${Prisma.join(
            this.variantConditions(query, "variant"),
            " AND ",
          )}
        CROSS JOIN search_query
        WHERE ${Prisma.join(conditions, " AND ")}
          AND (
            p.search_document @@ search_query.tsquery
            OR p.title OPERATOR(extensions.%) ${searchText}
          )
        GROUP BY p.id
      ),
      counted AS (
        SELECT id, relevance, lowest_price, created_at, count(*) OVER () AS total
        FROM matching_products
      ),
      total_count AS (
        SELECT count(*) AS total FROM matching_products
      )
      SELECT page.id::text AS id, total_count.total
      FROM total_count
      LEFT JOIN LATERAL (
        SELECT id
        FROM counted
        ORDER BY ${orderBy}, id ASC
        LIMIT ${query.pageSize} OFFSET ${offset}
      ) AS page ON true
    `);
  }

  private async priceSortedProductIds(
    query: CatalogQuery,
  ): Promise<SearchRow[]> {
    const conditions = this.rawPublicConditions(query);
    const order = Prisma.raw(
      query.sort === "price-asc" ? "ASC" : "DESC",
    );
    const offset = (query.page - 1) * query.pageSize;
    const priceConditions = this.variantConditions(query, "v");
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      WITH matching_products AS (
        SELECT p.id, min(v.price) AS lowest_price
        FROM public.products AS p
        JOIN public.vendors AS vendor ON vendor.id = p.vendor_id
        JOIN public.categories AS category ON category.id = p.category_id
        JOIN public.brands AS brand ON brand.id = p.brand_id
        JOIN public.product_variants AS v ON v.product_id = p.id
        WHERE ${Prisma.join(conditions, " AND ")}
          AND ${Prisma.join(priceConditions, " AND ")}
        GROUP BY p.id
      ),
      counted AS (
        SELECT id, lowest_price, count(*) OVER () AS total
        FROM matching_products
      ),
      total_count AS (
        SELECT count(*) AS total FROM matching_products
      )
      SELECT page.id::text AS id, total_count.total
      FROM total_count
      LEFT JOIN LATERAL (
        SELECT id
        FROM counted
        ORDER BY lowest_price ${order}, id ASC
        LIMIT ${query.pageSize} OFFSET ${offset}
      ) AS page ON true
    `);
  }

  private rawPublicConditions(query: CatalogQuery): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'ACTIVE'`,
      Prisma.sql`p.approval_status IN ('APPROVED', 'AUTO_APPROVED')`,
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`vendor.status = 'APPROVED'`,
      Prisma.sql`vendor.deleted_at IS NULL`,
      Prisma.sql`category.is_active = true`,
      Prisma.sql`brand.is_active = true`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM public.product_images AS image
        WHERE image.product_id = p.id
      )`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM public.product_variants AS variant
        WHERE variant.product_id = p.id
          AND variant.status = 'ACTIVE'
          AND variant.deleted_at IS NULL
      )`,
    ];

    if (query.category) {
      conditions.push(Prisma.sql`category.slug = ${query.category}`);
    }
    if (query.brand) conditions.push(Prisma.sql`brand.slug = ${query.brand}`);
    if (query.availability === "in-stock") {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM public.product_variants AS available_variant
          WHERE available_variant.product_id = p.id
            AND available_variant.status = 'ACTIVE'
            AND available_variant.deleted_at IS NULL
            AND available_variant.stock > 0
        )`,
      );
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceConditions: Prisma.Sql[] = [
        Prisma.sql`price_variant.product_id = p.id`,
        Prisma.sql`price_variant.status = 'ACTIVE'`,
        Prisma.sql`price_variant.deleted_at IS NULL`,
      ];
      if (query.minPrice !== undefined) {
        priceConditions.push(
          Prisma.sql`price_variant.price >= ${BigInt(query.minPrice)}`,
        );
      }
      if (query.maxPrice !== undefined) {
        priceConditions.push(
          Prisma.sql`price_variant.price <= ${BigInt(query.maxPrice)}`,
        );
      }
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM public.product_variants AS price_variant
          WHERE ${Prisma.join(priceConditions, " AND ")}
        )`,
      );
    }
    return conditions;
  }

  private variantConditions(
    query: CatalogQuery,
    alias: "variant" | "v",
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);
    const conditions: Prisma.Sql[] = [
      Prisma.sql`${table}.status = 'ACTIVE'`,
      Prisma.sql`${table}.deleted_at IS NULL`,
    ];
    if (query.availability === "in-stock") {
      conditions.push(Prisma.sql`${table}.stock > 0`);
    }
    if (query.minPrice !== undefined) {
      conditions.push(
        Prisma.sql`${table}.price >= ${BigInt(query.minPrice)}`,
      );
    }
    if (query.maxPrice !== undefined) {
      conditions.push(
        Prisma.sql`${table}.price <= ${BigInt(query.maxPrice)}`,
      );
    }
    return conditions;
  }

  private publicProductWhere(
    query: Partial<CatalogQuery> = {},
  ): Prisma.ProductWhereInput {
    const variantFilter: Prisma.ProductVariantWhereInput = {
      status: "ACTIVE",
      deletedAt: null,
    };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      variantFilter.price = {
        ...(query.minPrice !== undefined && {
          gte: BigInt(query.minPrice),
        }),
        ...(query.maxPrice !== undefined && {
          lte: BigInt(query.maxPrice),
        }),
      };
    }
    if (query.availability === "in-stock") variantFilter.stock = { gt: 0 };

    return {
      status: ProductStatus.ACTIVE,
      approvalStatus: { in: ["APPROVED", "AUTO_APPROVED"] },
      deletedAt: null,
      vendor: { status: "APPROVED", deletedAt: null },
      category: {
        isActive: true,
        ...(query.category && { slug: query.category }),
      },
      brand: {
        isActive: true,
        ...(query.brand && { slug: query.brand }),
      },
      variants: { some: variantFilter },
      images: { some: {} },
    };
  }

  private async loadProducts(ids: string[]): Promise<ProductRecord[]> {
    if (ids.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, ...this.publicProductWhere({}) },
      include: productInclude,
    });
    return products;
  }

  private serializeProduct(product: ProductRecord, query?: CatalogQuery) {
    const variants = product.variants.filter(
      (variant) =>
        (query?.minPrice === undefined ||
          variant.price >= BigInt(query.minPrice)) &&
        (query?.maxPrice === undefined ||
          variant.price <= BigInt(query.maxPrice)) &&
        (query?.availability !== "in-stock" || variant.stock > 0),
    );
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      condition: product.condition satisfies ProductCondition,
      category: product.category,
      brand: product.brand,
      vendor: { name: product.vendor.displayName },
      price: variants[0]
        ? {
            amount: variants[0].price.toString(),
            currency: variants[0].currency.trim(),
          }
        : null,
      availability: variants.some((variant) => variant.stock > 0)
        ? "IN_STOCK"
        : "OUT_OF_STOCK",
      variants: variants.map((variant) => ({
        id: variant.id,
        price: {
          amount: variant.price.toString(),
          currency: variant.currency.trim(),
        },
        compareAtPrice:
          variant.compareAtPrice === null
            ? null
            : variant.compareAtPrice.toString(),
        stock: variant.stock,
        gtin: variant.gtin,
        options: variant.optionValues,
        weightGrams: variant.weightGrams,
        dimensionsCm: {
          length: variant.lengthCm?.toString() ?? null,
          width: variant.widthCm?.toString() ?? null,
          height: variant.heightCm?.toString() ?? null,
        },
      })),
      images: product.images.map((image) => ({
        path: image.storagePath,
        url: this.publicImageUrl(image.storagePath),
        alt: image.altText,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        isPrimary: image.isPrimary,
      })),
      createdAt: product.createdAt.toISOString(),
    };
  }

  private publicImageUrl(storagePath: string): string {
    const supabaseUrl = process.env.SUPABASE_URL;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA;
    if (!supabaseUrl || !bucket) {
      throw new ServiceUnavailableException({
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Product media is temporarily unavailable.",
        },
      });
    }
    const baseUrl = new URL(supabaseUrl);
    const encodedPath = storagePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${baseUrl.origin}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private handleDatabaseError(error: unknown, message: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    this.logger.error(`${message} ${detail.replace(/[\r\n\t]/g, " ").slice(0, 500)}`);
    throw new ServiceUnavailableException({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The catalog is temporarily unavailable.",
      },
    });
  }
}
