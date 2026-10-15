import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLineTax,
  calculateShippingAmount,
} from "../src/modules/checkout/checkout-pricing";
import {
  parseCheckoutDestination,
  parseCreateOrderInput,
  parseCheckoutQuoteId,
  parseIdempotencyKey,
  parseTrackOrderInput,
} from "../src/modules/checkout/checkout-query";

test("shipping rates use integer amounts and the configured rate shape", () => {
  assert.equal(
    calculateShippingAmount(10_000n, 500n, { type: "FLAT", amount: 250n }),
    250n,
  );
  assert.equal(
    calculateShippingAmount(5_000n, 500n, {
      type: "FREE_OVER_THRESHOLD",
      amount: 300n,
      freeAboveAmount: 5_000n,
    }),
    0n,
  );
  assert.equal(
    calculateShippingAmount(4_999n, 500n, {
      type: "FREE_OVER_THRESHOLD",
      amount: 300n,
      freeAboveAmount: 5_000n,
    }),
    300n,
  );
  assert.equal(
    calculateShippingAmount(1_000n, 1_501n, {
      type: "WEIGHT_BASED",
      baseAmount: 100n,
      amountPerKilogram: 50n,
    }),
    200n,
  );
});

test("weight-based shipping requires configured product weight", () => {
  assert.throws(
    () =>
      calculateShippingAmount(1_000n, 0n, {
        type: "WEIGHT_BASED",
        baseAmount: 100n,
        amountPerKilogram: 50n,
      }),
    RangeError,
  );
});

test("tax calculation supports inclusive and exclusive rates with half-up rounding", () => {
  assert.equal(calculateLineTax(1_000n, 1_000, "INCLUSIVE"), 91n);
  assert.equal(calculateLineTax(1_000n, 1_000, "EXCLUSIVE"), 100n);
  assert.equal(calculateLineTax(1n, 5_000, "EXCLUSIVE"), 1n);
  assert.equal(calculateLineTax(1_000n, 0, "EXCLUSIVE"), 0n);
});

test("checkout destination accepts only a bounded Pakistan province and city", () => {
  assert.deepEqual(
    parseCheckoutDestination({ province: " Punjab ", city: " Lahore " }),
    { province: "Punjab", city: "Lahore", countryCode: "PK" },
  );
  for (const input of [
    null,
    { province: "Punjab" },
    { province: "P", city: "Lahore" },
    { province: "Punjab", city: "Lahore", countryCode: "US" },
  ]) {
    assert.throws(() => parseCheckoutDestination(input));
  }
});

test("order creation accepts only UUID quote and idempotency identifiers", () => {
  const validId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(parseCheckoutQuoteId(validId), validId);
  assert.equal(parseIdempotencyKey(validId), validId);
  assert.throws(() => parseCheckoutQuoteId("invalid"));
  assert.throws(() => parseIdempotencyKey(undefined));
});

test("order creation validates and normalizes guest contact and delivery details", () => {
  const quoteId = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(
    parseCreateOrderInput({
      quoteId,
      buyerEmail: " BUYER@example.com ",
      buyerPhone: "+923001234567",
      recipientName: " Test Buyer ",
      addressLine1: " 10 Main Street ",
    }),
    {
      quoteId,
      buyerEmail: "buyer@example.com",
      buyerPhone: "+923001234567",
      recipientName: "Test Buyer",
      addressLine1: "10 Main Street",
    },
  );
  assert.throws(() =>
    parseCreateOrderInput({
      quoteId,
      buyerEmail: "buyer@example.com",
      buyerPhone: "+923001234567",
      recipientName: "Test Buyer",
      addressLine1: "10 Main Street",
      total: 1,
    }),
  );
});

test("guest tracking requires an order number and unguessable-format token", () => {
  const token = "A".repeat(43);
  assert.deepEqual(
    parseTrackOrderInput({ orderNumber: "ATV-2610-000001", token }),
    { orderNumber: "ATV-2610-000001", trackingToken: token },
  );
  assert.throws(() => parseTrackOrderInput({ orderNumber: "ATV-2610-000001" }));
  assert.throws(() =>
    parseTrackOrderInput({ orderNumber: "ATV-2610-000001", token, email: "x@y.z" }),
  );
});