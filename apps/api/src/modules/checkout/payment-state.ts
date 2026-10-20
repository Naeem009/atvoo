export const paymentStatuses = [
  "INITIATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "REFUND_FAILED",
  "DISPUTE_OPEN",
  "WON",
  "LOST",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

const paymentTransitions: Readonly<
  Record<PaymentStatus, readonly PaymentStatus[]>
> = {
  INITIATED: ["AUTHORIZED", "FAILED", "CANCELLED"],
  AUTHORIZED: ["CAPTURED", "FAILED", "CANCELLED"],
  CAPTURED: ["REFUND_PENDING", "DISPUTE_OPEN"],
  FAILED: [],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED", "REFUND_FAILED"],
  REFUNDED: [],
  REFUND_FAILED: [],
  DISPUTE_OPEN: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export function isPaymentTransitionAllowed(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  return paymentTransitions[current].includes(next);
}