import { PrismaService } from "../database/prisma.service";
export declare class CartService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getCart(sessionId?: string): Promise<{
        sessionId: string;
        data: {
            items: {
                id: string;
                variantId: string;
                title: string;
                slug: string;
                vendor: string;
                category: string;
                image: {
                    path: string;
                    alt: string | null;
                } | null;
                quantity: number;
                stock: number;
                available: boolean;
                warnings: string[];
                price: {
                    amount: string;
                    currency: string;
                };
                previousPrice: {
                    amount: string;
                    currency: string;
                } | null;
                lineTotal: {
                    amount: string;
                    currency: string;
                };
            }[];
            itemCount: number;
            totals: {
                currency: string;
                amount: string;
            }[];
            expiresAt: string;
        };
    }>;
    addItem(sessionId: string | undefined, variantId: string, quantity: number): Promise<{
        sessionId: string;
        data: {
            items: {
                id: string;
                variantId: string;
                title: string;
                slug: string;
                vendor: string;
                category: string;
                image: {
                    path: string;
                    alt: string | null;
                } | null;
                quantity: number;
                stock: number;
                available: boolean;
                warnings: string[];
                price: {
                    amount: string;
                    currency: string;
                };
                previousPrice: {
                    amount: string;
                    currency: string;
                } | null;
                lineTotal: {
                    amount: string;
                    currency: string;
                };
            }[];
            itemCount: number;
            totals: {
                currency: string;
                amount: string;
            }[];
            expiresAt: string;
        };
    }>;
    updateItem(sessionId: string | undefined, itemId: string, quantity: number): Promise<{
        sessionId: string;
        data: {
            items: {
                id: string;
                variantId: string;
                title: string;
                slug: string;
                vendor: string;
                category: string;
                image: {
                    path: string;
                    alt: string | null;
                } | null;
                quantity: number;
                stock: number;
                available: boolean;
                warnings: string[];
                price: {
                    amount: string;
                    currency: string;
                };
                previousPrice: {
                    amount: string;
                    currency: string;
                } | null;
                lineTotal: {
                    amount: string;
                    currency: string;
                };
            }[];
            itemCount: number;
            totals: {
                currency: string;
                amount: string;
            }[];
            expiresAt: string;
        };
    }>;
    removeItem(sessionId: string | undefined, itemId: string): Promise<{
        sessionId: string;
        data: {
            items: {
                id: string;
                variantId: string;
                title: string;
                slug: string;
                vendor: string;
                category: string;
                image: {
                    path: string;
                    alt: string | null;
                } | null;
                quantity: number;
                stock: number;
                available: boolean;
                warnings: string[];
                price: {
                    amount: string;
                    currency: string;
                };
                previousPrice: {
                    amount: string;
                    currency: string;
                } | null;
                lineTotal: {
                    amount: string;
                    currency: string;
                };
            }[];
            itemCount: number;
            totals: {
                currency: string;
                amount: string;
            }[];
            expiresAt: string;
        };
    }>;
    private ensureCart;
    private findSellableVariant;
    private serializeCart;
    private assertQuantity;
    private expiryDate;
    private conflict;
    private notFound;
    private handleDatabaseError;
}
