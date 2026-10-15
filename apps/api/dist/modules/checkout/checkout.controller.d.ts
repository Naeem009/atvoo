import { CheckoutService } from "./checkout.service";
export declare class CheckoutController {
    private readonly checkoutService;
    constructor(checkoutService: CheckoutService);
    createQuote(header: string | undefined, body: unknown): Promise<{
        data: {
            quoteId: string;
            expiresAt: string;
            currency: string;
            destination: import("./checkout-query").CheckoutDestination;
            lines: {
                variantId: string;
                vendorId: string;
                title: string;
                sku: string;
                quantity: number;
                unitPrice: string;
                currency: string;
                taxClass: string;
                taxRateBps: number;
                taxTreatment: import("./checkout-pricing").TaxTreatmentInput;
                subtotal: string;
                netSubtotal: string;
                taxAmount: string;
                total: string;
                weightGrams: number | null;
            }[];
            shipments: {
                vendorId: string;
                profileId: string;
                rateId: string;
                carrierName: string;
                shippingTaxClass: string;
                shippingTaxRateBps: number;
                shippingTaxTreatment: import("./checkout-pricing").TaxTreatmentInput;
                baseAmount: string;
                netAmount: string;
                taxAmount: string;
                total: string;
                handlingDays: number;
                transitDays: number;
                codAllowed: boolean;
            }[];
            totals: {
                subtotal: string;
                shipping: string;
                tax: string;
                total: string;
            };
        };
    }>;
}
