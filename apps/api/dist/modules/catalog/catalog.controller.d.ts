import type { Response } from "express";
import { CatalogService } from "./catalog.service";
export declare class CatalogController {
    private readonly catalogService;
    constructor(catalogService: CatalogService);
    searchProducts(query: Record<string, unknown>, ifNoneMatch: string | undefined, response: Response): Promise<{
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
                options: import("@prisma/client/runtime/library").JsonValue;
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
    } | undefined>;
    listProducts(query: Record<string, unknown>, ifNoneMatch: string | undefined, response: Response): Promise<{
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
                options: import("@prisma/client/runtime/library").JsonValue;
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
    } | undefined>;
    getProduct(idOrSlug: string, ifNoneMatch: string | undefined, response: Response): Promise<{
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
                options: import("@prisma/client/runtime/library").JsonValue;
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
    } | undefined>;
    listCategories(ifNoneMatch: string | undefined, response: Response): Promise<{
        data: {
            id: string;
            _count: {
                products: number;
            };
            parentId: string | null;
            name: string;
            slug: string;
            description: string | null;
            displayOrder: number;
        }[];
    } | undefined>;
    listBrands(ifNoneMatch: string | undefined, response: Response): Promise<{
        data: {
            id: string;
            name: string;
            slug: string;
        }[];
    } | undefined>;
    private setCacheHeaders;
}
