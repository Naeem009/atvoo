import assert from "node:assert/strict";
import test from "node:test";
import {
  isPaymentTransitionAllowed,
  paymentStatuses,
  type PaymentStatus,
} from "../src/modules/checkout/payment-state";

test("payment transitions follow the documented authorization, capture, refund, and dispute paths", () => {
  const allowedTransitions: readonly [PaymentStatus, PaymentStatus][] = [
    ["INITIATED", "AUTHORIZED"],
    ["INITIATED", "FAILED"],
    ["INITIATED", "CANCELLED"],
    ["AUTHORIZED", "CAPTURED"],
    ["AUTHORIZED", "FAILED"],
    ["AUTHORIZED", "CANCELLED"],
    ["CAPTURED", "REFUND_PENDING"],
    ["CAPTURED", "DISPUTE_OPEN"],
    ["REFUND_PENDING", "REFUNDED"],
    ["REFUND_PENDING", "REFUND_FAILED"],
    ["DISPUTE_OPEN", "WON"],
    ["DISPUTE_OPEN", "LOST"],
  ];

  for (const [current, next] of allowedTransitions) {
    assert.equal(
      isPaymentTransitionAllowed(current, next),
      true,
      `${current} should transition to ${next}`,
    );
  }
});

test("payment transitions reject skipped states, repeats, and terminal-state changes", () => {
  const rejectedTransitions: readonly [PaymentStatus, PaymentStatus][] = [
    ["INITIATED", "CAPTURED"],
    ["AUTHORIZED", "REFUND_PENDING"],
    ["CAPTURED", "FAILED"],
    ["REFUND_PENDING", "CAPTURED"],
    ["DISPUTE_OPEN", "REFUNDED"],
  ];

  for (const [current, next] of rejectedTransitions) {
    assert.equal(
      isPaymentTransitionAllowed(current, next),
      false,
      `${current} must not transition to ${next}`,
    );
  }

  for (const status of paymentStatuses) {
    assert.equal(isPaymentTransitionAllowed(status, status), false);
  }
});

test("failed, cancelled, refunded, and resolved-dispute payments are terminal", () => {
  for (const status of ["FAILED", "CANCELLED", "REFUNDED", "REFUND_FAILED", "WON", "LOST"] as const) {
    for (const next of paymentStatuses) {
      assert.equal(isPaymentTransitionAllowed(status, next), false);
    }
  }
});