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
export declare function parseCatalogQuery(input: Record<string, unknown>): CatalogQuery;
