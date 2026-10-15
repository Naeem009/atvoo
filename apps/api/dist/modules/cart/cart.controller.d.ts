import type { Response } from "express";
import { CartService } from "./cart.service";
export declare class CartController {
    private readonly cartService;
    constructor(cartService: CartService);
    getCart(header: string | undefined, response: Response): Promise<{
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
    addItem(header: string | undefined, body: unknown, response: Response): Promise<{
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
    updateItem(header: string | undefined, rawItemId: string, body: unknown, response: Response): Promise<{
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
    removeItem(header: string | undefined, rawItemId: string, response: Response): Promise<{
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
}
