export type CheckoutDestination = {
    province: string;
    city: string;
    countryCode: "PK";
};
export type CreateOrderInput = {
    quoteId: string;
    buyerEmail: string;
    buyerPhone: string;
    recipientName: string;
    addressLine1: string;
    addressLine2?: string;
    postalCode?: string;
};
export declare function parseCheckoutQuoteId(value: unknown): string;
export declare function parseIdempotencyKey(value: unknown): string;
export declare function parseCreateOrderInput(value: unknown): CreateOrderInput;
export declare function parseCheckoutDestination(value: unknown): CheckoutDestination;
