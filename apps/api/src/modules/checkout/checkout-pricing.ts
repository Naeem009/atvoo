export type ShippingRateInput =
  | { type: "FLAT"; amount: bigint }
  | {
      type: "FREE_OVER_THRESHOLD";
      amount: bigint;
      freeAboveAmount: bigint;
    }
  | {
      type: "WEIGHT_BASED";
      baseAmount: bigint;
      amountPerKilogram: bigint;
    };

export type TaxTreatmentInput = "INCLUSIVE" | "EXCLUSIVE";

export function calculateShippingAmount(
  vendorSubtotal: bigint,
  totalWeightGrams: bigint,
  rate: ShippingRateInput,
): bigint {
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

export function calculateLineTax(
  amount: bigint,
  rateBps: number,
  treatment: TaxTreatmentInput,
): bigint {
  if (amount < 0n || !Number.isInteger(rateBps) || rateBps < 0) {
    throw new RangeError("Tax inputs are invalid.");
  }

  const rate = BigInt(rateBps);
  const denominator = treatment === "INCLUSIVE" ? 10_000n + rate : 10_000n;
  return roundHalfUp(amount * rate, denominator);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}