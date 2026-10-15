import assert from "node:assert/strict";
import test from "node:test";
import {
  isOrderTransitionAllowed,
  isShipmentTransitionAllowed,
  orderStatuses,
  shipmentStatuses,
  type OrderStatus,
  type ShipmentStatus,
} from "../src/modules/orders/order-state";
import { calculateAvailableStock } from "../src/modules/orders/inventory";

test("order transitions follow the documented payment and fulfilment path", () => {
  const allowedTransitions: readonly [OrderStatus, OrderStatus][] = [
    ["PENDING_PAYMENT", "PAID"],
    ["PENDING_PAYMENT", "COD_CONFIRMED"],
    ["PAID", "PROCESSING"],
    ["COD_CONFIRMED", "PROCESSING"],
    ["PROCESSING", "PARTIALLY_SHIPPED"],
    ["PARTIALLY_SHIPPED", "SHIPPED"],
    ["SHIPPED", "PARTIALLY_DELIVERED"],
    ["PARTIALLY_DELIVERED", "DELIVERED"],
    ["DELIVERED", "COMPLETED"],
  ];

  for (const [current, next] of allowedTransitions) {
    assert.equal(isOrderTransitionAllowed(current, next), true);
  }
});

test("order transitions reject skipped, repeated, and unspecified side-state changes", () => {
  const rejectedTransitions: readonly [OrderStatus, OrderStatus][] = [
    ["PENDING_PAYMENT", "PROCESSING"],
    ["PAID", "DELIVERED"],
    ["PROCESSING", "PROCESSING"],
    ["DELIVERED", "REFUND_PENDING"],
    ["PENDING_PAYMENT", "CANCELLED"],
    ["PENDING_PAYMENT", "FAILED_PAYMENT"],
  ];

  for (const [current, next] of rejectedTransitions) {
    assert.equal(isOrderTransitionAllowed(current, next), false);
  }

  for (const status of orderStatuses) {
    if (["COMPLETED", "CANCELLED", "FAILED_PAYMENT", "REFUND_PENDING", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status)) {
      for (const next of orderStatuses) {
        assert.equal(isOrderTransitionAllowed(status, next), false);
      }
    }
  }
});

test("shipment transitions follow the documented fulfilment path", () => {
  const allowedTransitions: readonly [ShipmentStatus, ShipmentStatus][] = [
    ["PENDING", "PACKED"],
    ["PACKED", "HANDED_TO_CARRIER"],
    ["HANDED_TO_CARRIER", "IN_TRANSIT"],
    ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
    ["OUT_FOR_DELIVERY", "DELIVERED"],
  ];

  for (const [current, next] of allowedTransitions) {
    assert.equal(isShipmentTransitionAllowed(current, next), true);
  }
});

test("shipment transitions reject skipped, repeated, and unspecified exception changes", () => {
  const rejectedTransitions: readonly [ShipmentStatus, ShipmentStatus][] = [
    ["PENDING", "HANDED_TO_CARRIER"],
    ["PACKED", "DELIVERED"],
    ["IN_TRANSIT", "IN_TRANSIT"],
    ["OUT_FOR_DELIVERY", "RETURNING"],
    ["IN_TRANSIT", "DELIVERY_FAILED"],
  ];

  for (const [current, next] of rejectedTransitions) {
    assert.equal(isShipmentTransitionAllowed(current, next), false);
  }

  for (const status of shipmentStatuses) {
    if (["DELIVERED", "DELIVERY_FAILED", "RETURNING", "RETURNED", "LOST"].includes(status)) {
      for (const next of shipmentStatuses) {
        assert.equal(isShipmentTransitionAllowed(status, next), false);
      }
    }
  }
});

test("available stock subtracts active reservations without going below zero", () => {
  assert.equal(calculateAvailableStock(10, 3), 7);
  assert.equal(calculateAvailableStock(4, 4), 0);
  assert.equal(calculateAvailableStock(2, 5), 0);
});