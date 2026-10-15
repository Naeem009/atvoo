import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { CatalogQuery } from "./catalog-query";
export declare class CatalogService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    listProducts(query: CatalogQuery): Promise<{
        data: {
            id: string;
            slug: string;
            title: string;
            description: string | null;
            condition: import(".prisma/client").$Enums.ProductCondition;
            category: {
                name: string;
                slug: string;
            };
            brand: {
                name: string;
                slug: string;
            } | null;
            vendor: {
                name: string;
            };
            price: {
                amount: string;
                currency: string;
            } | null;
            availability: string;
            variants: {
                id: string;
                price: {
                    amount: string;
                    currency: string;
                };
                compareAtPrice: string | null;
                stock: number;
                gtin: string | null;
                options: Prisma.JsonValue;
                weightGrams: number | null;
                dimensionsCm: {
                    length: string | null;
                    width: string | null;
                    height: string | null;
                };
            }[];
            images: {
                path: string;
                url: string;
                alt: string | null;
                mimeType: string;
                width: number;
                height: number;
                isPrimary: boolean;
            }[];
            createdAt: string;
        }[];
        meta: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>;
    getProduct(idOrSlug: string): Promise<{
        data: {
            id: string;
            slug: string;
            title: string;
            description: string | null;
            condition: import(".prisma/client").$Enums.ProductCondition;
            category: {
                name: string;
                slug: string;
            };
            brand: {
                name: string;
                slug: string;
            } | null;
            vendor: {
                name: string;
            };
            price: {
                amount: string;
                currency: string;
            } | null;
            availability: string;
            variants: {
                id: string;
                price: {
                    amount: string;
                    currency: string;
                };
                compareAtPrice: string | null;
                stock: number;
                gtin: string | null;
                options: Prisma.JsonValue;
                weightGrams: number | null;
                dimensionsCm: {
                    length: string | null;
                    width: string | null;
                    height: string | null;
                };
            }[];
            images: {
                path: string;
                url: string;
                alt: string | null;
                mimeType: string;
                width: number;
                height: number;
                isPrimary: boolean;
            }[];
            createdAt: string;
        };
    }>;
    listCategories(): Promise<{
        data: {
            id: string;
            name: string;
            _count: {
                products: number;
            };
            slug: string;
            description: string | null;
            parentId: string | null;
            displayOrder: number;
        }[];
    }>;
    listBrands(): Promise<{
        data: {
            id: string;
            name: string;
            slug: string;
        }[];
    }>;
    createEtag(data: unknown): string;
    private searchProductIds;
    private priceSortedProductIds;
    private rawPublicConditions;
    private variantConditions;
    private publicProductWhere;
    private loadProducts;
    private serializeProduct;
    private publicImageUrl;
    private isUuid;
    private handleDatabaseError;
}
