import { OrderStatus } from "@prisma/client";
import type { CreateOrderInput } from "./checkout-query";
import { PrismaService } from "../database/prisma.service";
type OrderCreatedResponse = {
    orderId: string;
    orderNumber: string;
    trackingToken: string;
    status: OrderStatus;
    currency: string;
    totals: {
        subtotal: string;
        shipping: string;
        tax: string;
        total: string;
    };
    reservationExpiresAt: string;
};
export declare class OrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createGuestOrder(sessionId: string, idempotencyKey: string, input: CreateOrderInput): Promise<{
        data: OrderCreatedResponse;
        replayed: boolean;
    }>;
    trackGuestOrder(orderNumber: string, trackingToken: string): Promise<{
        orderNumber: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        currency: string;
        totals: {
            subtotal: string;
            shipping: string;
            tax: string;
            total: string;
        };
        createdAt: string;
        items: {
            title: string;
            quantity: number;
            unitPrice: string;
            taxAmount: string;
        }[];
        shipments: {
            status: import(".prisma/client").$Enums.ShipmentStatus;
            carrier: string | null;
            trackingNumber: string | null;
            shippingAmount: string;
            taxAmount: string;
            createdAt: string;
        }[];
        statusHistory: {
            status: import(".prisma/client").$Enums.OrderStatus | null;
            createdAt: string;
            reason: string | null;
        }[];
    }>;
    private findIdempotencyRecord;
    private replayOrReject;
    private assertAddressMatches;
    private assertCartMatches;
    private assertCurrentStock;
    private allocateOrderNumber;
    private conflict;
    private notFound;
    private unavailable;
}
export {};
