"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateShippingAmount = calculateShippingAmount;
exports.calculateLineTax = calculateLineTax;
function calculateShippingAmount(vendorSubtotal, totalWeightGrams, rate) {
    if (vendorSubtotal < 0n || totalWeightGrams < 0n) {
        throw new RangeError("Shipping inputs must not be negative.");
    }
    switch (rate.type) {
        case "FLAT":
            return rate.amount;
        case "FREE_OVER_THRESHOLD":
            return vendorSubtotal >= rate.freeAboveAmount ? 0n : rate.amount;
        case "WEIGHT_BASED": {
            if (totalWeightGrams === 0n) {
                throw new RangeError("Weight is required for a weight-based rate.");
            }
            const billableKilograms = (totalWeightGrams + 999n) / 1000n;
            return rate.baseAmount + billableKilograms * rate.amountPerKilogram;
        }
    }
}
function calculateLineTax(amount, rateBps, treatment) {
    if (amount < 0n || !Number.isInteger(rateBps) || rateBps < 0) {
        throw new RangeError("Tax inputs are invalid.");
    }
    const rate = BigInt(rateBps);
    const denominator = treatment === "INCLUSIVE" ? 10000n + rate : 10000n;
    return roundHalfUp(amount * rate, denominator);
}
function roundHalfUp(numerator, denominator) {
    return (numerator * 2n + denominator) / (denominator * 2n);
}
//# sourceMappingURL=checkout-pricing.js.map