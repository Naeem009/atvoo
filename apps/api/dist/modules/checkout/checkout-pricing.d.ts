export type ShippingRateInput = {
    type: "FLAT";
    amount: bigint;
} | {
    type: "FREE_OVER_THRESHOLD";
    amount: bigint;
    freeAboveAmount: bigint;
} | {
    type: "WEIGHT_BASED";
    baseAmount: bigint;
    amountPerKilogram: bigint;
};
export type TaxTreatmentInput = "INCLUSIVE" | "EXCLUSIVE";
export declare function calculateShippingAmount(vendorSubtotal: bigint, totalWeightGrams: bigint, rate: ShippingRateInput): bigint;
export declare function calculateLineTax(amount: bigint, rateBps: number, treatment: TaxTreatmentInput): bigint;
