export const orderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "COD_CONFIRMED",
  "PROCESSING",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "FAILED_PAYMENT",
  "REFUND_PENDING",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const shipmentStatuses = [
  "PENDING",
  "PACKED",
  "HANDED_TO_CARRIER",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNING",
  "RETURNED",
  "LOST",
] as const;

export type ShipmentStatus = (typeof shipmentStatuses)[number];

const orderTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "COD_CONFIRMED"],
  PAID: ["PROCESSING"],
  COD_CONFIRMED: ["PROCESSING"],
  PROCESSING: ["PARTIALLY_SHIPPED"],
  PARTIALLY_SHIPPED: ["SHIPPED"],
  SHIPPED: ["PARTIALLY_DELIVERED"],
  PARTIALLY_DELIVERED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED_PAYMENT: [],
  REFUND_PENDING: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
};

const shipmentTransitions: Readonly<
  Record<ShipmentStatus, readonly ShipmentStatus[]>
> = {
  PENDING: ["PACKED"],
  PACKED: ["HANDED_TO_CARRIER"],
  HANDED_TO_CARRIER: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  DELIVERY_FAILED: [],
  RETURNING: [],
  RETURNED: [],
  LOST: [],
};

export function isOrderTransitionAllowed(
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  return orderTransitions[current].includes(next);
}

export function isShipmentTransitionAllowed(
  current: ShipmentStatus,
  next: ShipmentStatus,
): boolean {
  return shipmentTransitions[current].includes(next);
}