import type { CheckoutDestination } from "./checkout-query";
import { type TaxTreatmentInput } from "./checkout-pricing";
import { PrismaService } from "../database/prisma.service";
type QuoteLineSnapshot = {
    variantId: string;
    vendorId: string;
    title: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    currency: string;
    taxClass: string;
    taxRateBps: number;
    taxTreatment: TaxTreatmentInput;
    subtotal: string;
    netSubtotal: string;
    taxAmount: string;
    total: string;
    weightGrams: number | null;
};
type QuoteShipmentSnapshot = {
    vendorId: string;
    profileId: string;
    rateId: string;
    carrierName: string;
    shippingTaxClass: string;
    shippingTaxRateBps: number;
    shippingTaxTreatment: TaxTreatmentInput;
    baseAmount: string;
    netAmount: string;
    taxAmount: string;
    total: string;
    handlingDays: number;
    transitDays: number;
    codAllowed: boolean;
};
export declare class CheckoutService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createQuote(sessionId: string, destination: CheckoutDestination): Promise<{
        quoteId: string;
        expiresAt: string;
        currency: string;
        destination: CheckoutDestination;
        lines: QuoteLineSnapshot[];
        shipments: QuoteShipmentSnapshot[];
        totals: {
            subtotal: string;
            shipping: string;
            tax: string;
            total: string;
        };
    }>;
    private assertSellable;
    private availableStock;
    private loadTaxRates;
    private loadShippingProfiles;
    private priceShipments;
    private toShippingRate;
    private conflict;
    private notFound;
    private unavailable;
}
export {};
