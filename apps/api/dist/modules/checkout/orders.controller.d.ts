import type { Response } from "express";
import { OrdersService } from "./orders.service";
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    createOrder(rawSessionId: string | undefined, rawIdempotencyKey: string | undefined, body: unknown, response: Response): Promise<{
        data: {
            orderId: string;
            orderNumber: string;
            trackingToken: string;
            status: import(".prisma/client").OrderStatus;
            currency: string;
            totals: {
                subtotal: string;
                shipping: string;
                tax: string;
                total: string;
            };
            reservationExpiresAt: string;
        };
    }>;
}
