import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { OrderStatus, ShipmentStatus } from "@prisma/client";
import type { PrismaService } from "../src/modules/database/prisma.service";
import { OrdersService } from "../src/modules/checkout/orders.service";

const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const quoteId = "123e4567-e89b-42d3-a456-426614174001";
const idempotencyKey = "123e4567-e89b-42d3-a456-426614174002";
const cartId = "123e4567-e89b-42d3-a456-426614174003";
const vendorId = "123e4567-e89b-42d3-a456-426614174004";
const variantId = "123e4567-e89b-42d3-a456-426614174005";

function createFixture(options?: { reserved?: number }) {
  const now = new Date();
  const snapshot = {
    cartId,
    destination: { province: "Punjab", city: "Lahore", countryCode: "PK" },
    currency: "PKR",
    lines: [
      {
        variantId,
        vendorId,
        title: "Test item",
        sku: "SKU-1",
        quantity: 1,
        unitPrice: "1100",
        currency: "PKR",
        taxAmount: "100",
      },
    ],
    shipments: [{ vendorId, shippingAmount: "200", taxAmount: "20" }],
    subtotal: "1000",
    shippingTotal: "200",
    taxTotal: "120",
    total: "1320",
  };
  const cart = {
    id: cartId,
    sessionId,
    expiresAt: new Date(now.getTime() + 60_000),
    items: [
      {
        productVariantId: variantId,
        quantity: 1,
        unitPrice: 1_100n,
        currency: "PKR",
        productVariant: {
          id: variantId,
          vendorId,
          sku: "SKU-1",
          status: "ACTIVE",
          price: 1_100n,
          currency: "PKR",
          stock: 5,
          deletedAt: null,
          product: {
            title: "Test item",
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            deletedAt: null,
            vendor: { status: "APPROVED", deletedAt: null },
            category: { isActive: true },
            brand: { isActive: true },
            images: [{ id: "image" }],
          },
        },
      },
    ],
  };
  let storedIdempotencyRecord: Record<string, unknown> | null = null;
  const calls = {
    orders: [] as unknown[],
    shipments: [] as unknown[],
    items: [] as unknown[],
    reservations: [] as unknown[],
    consumedQuotes: [] as unknown[],
  };
  const transaction = {
    idempotencyKey: {
      findUnique: async () => storedIdempotencyRecord,
      delete: async () => {
        storedIdempotencyRecord = null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        storedIdempotencyRecord = data;
      },
    },
    checkoutQuote: {
      findUnique: async () => ({
        id: quoteId,
        cartId,
        requestHash: "quote-hash",
        snapshot,
        expiresAt: new Date(now.getTime() + 60_000),
        consumedAt: null,
        cart: { ...cart, items: cart.items },
      }),
      updateMany: async (input: unknown) => {
        calls.consumedQuotes.push(input);
        return { count: 1 };
      },
    },
    stockReservation: {
      groupBy: async () =>
        (options?.reserved ?? 0) > 0
          ? [{ productVariantId: variantId, _sum: { quantity: options?.reserved } }]
          : [],
      create: async (input: unknown) => calls.reservations.push(input),
    },
    orderNumberCounter: {
      upsert: async () => ({ nextValue: 2n }),
    },
    order: {
      create: async (input: unknown) => {
        calls.orders.push(input);
        return {
          id: "order-1",
          orderNumber: "ATV-2610-000001",
          status: OrderStatus.PENDING_PAYMENT,
        };
      },
    },
    shipment: {
      create: async ({ data }: { data: { vendorId: string } }) => {
        calls.shipments.push(data);
        return { id: "shipment-1", vendorId: data.vendorId };
      },
    },
    orderItem: {
      create: async (input: unknown) => calls.items.push(input),
    },
  };
  const prisma = {
    idempotencyKey: {
      findUnique: async () => storedIdempotencyRecord,
      delete: async () => {
        storedIdempotencyRecord = null;
      },
    },
    $transaction: async (
      operation: (tx: typeof transaction) => Promise<unknown>,
    ) => operation(transaction),
  };

  return {
    service: new OrdersService(prisma as unknown as PrismaService),
    calls,
    getIdempotencyRecord: () => storedIdempotencyRecord,
  };
}

const input = {
  quoteId,
  buyerEmail: "buyer@example.com",
  buyerPhone: "+923001234567",
  recipientName: "Test Buyer",
  addressLine1: "10 Main Street",
};

test("guest order atomically consumes quote and creates vendor shipment/items/reservation", async () => {
  const { service, calls } = createFixture();
  const result = await service.createGuestOrder(sessionId, idempotencyKey, input);

  assert.equal(result.replayed, false);
  assert.equal(result.data.orderNumber, "ATV-2610-000001");
  assert.equal(result.data.status, OrderStatus.PENDING_PAYMENT);
  assert.equal(calls.orders.length, 1);
  assert.equal(calls.shipments.length, 1);
  assert.equal(calls.items.length, 1);
  assert.equal(calls.reservations.length, 1);
  assert.equal(calls.consumedQuotes.length, 1);
  const reservation = calls.reservations[0] as {
    data: { expiresAt: Date };
  };
  const reservationExpiry = reservation.data.expiresAt;
  const order = calls.orders[0] as {
    data: { total: bigint; shippingTotal: bigint; taxTotal: bigint };
  };
  assert.equal(order.data.total, 1_320n);
  assert.equal(order.data.shippingTotal, 200n);
  assert.equal(order.data.taxTotal, 120n);
  assert.ok(reservationExpiry.getTime() > Date.now());
  assert.equal(calls.shipments[0] && (calls.shipments[0] as { status: string }).status, ShipmentStatus.PENDING);
});

test("identical idempotency retries replay the stored order response", async () => {
  const { service, calls } = createFixture();
  const first = await service.createGuestOrder(sessionId, idempotencyKey, input);
  const second = await service.createGuestOrder(sessionId, idempotencyKey, input);

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.data, first.data);
  assert.equal(calls.orders.length, 1);
});

test("reusing an idempotency key with a different body is rejected", async () => {
  const { service, calls } = createFixture();
  await service.createGuestOrder(sessionId, idempotencyKey, input);
  await assert.rejects(
    service.createGuestOrder(sessionId, idempotencyKey, {
      ...input,
      buyerEmail: "other@example.com",
    }),
    ConflictException,
  );
  assert.equal(calls.orders.length, 1);
});

test("order creation rejects exhausted inventory before writing the order", async () => {
  const { service, calls } = createFixture({ reserved: 5 });
  await assert.rejects(
    service.createGuestOrder(sessionId, idempotencyKey, input),
    ConflictException,
  );
  assert.equal(calls.orders.length, 0);
  assert.equal(calls.reservations.length, 0);
});

test("guest tracking returns order details only for the matching private token", async () => {
  const trackingToken = "A".repeat(43);
  const trackingTokenHash = createHash("sha256")
    .update(JSON.stringify(trackingToken))
    .digest("hex");
  const service = new OrdersService({
    order: {
      findUnique: async () => ({
        trackingTokenHash,
        status: OrderStatus.PENDING_PAYMENT,
        currency: "PKR",
        subtotal: 1_000n,
        shippingTotal: 200n,
        taxTotal: 120n,
        total: 1_320n,
        createdAt: new Date("2026-10-20T10:00:00.000Z"),
        items: [
          {
            productTitle: "Test item",
            quantity: 1,
            unitPrice: 1_100n,
            taxAmount: 100n,
          },
        ],
        shipments: [],
        statusHistory: [],
      }),
    },
  } as unknown as PrismaService);

  const result = await service.trackGuestOrder("ATV-2610-000001", trackingToken);

  assert.equal(result.orderNumber, "ATV-2610-000001");
  assert.deepEqual(result.totals, {
    subtotal: "1000",
    shipping: "200",
    tax: "120",
    total: "1320",
  });
  assert.equal("buyerEmail" in result, false);
  assert.equal("trackingToken" in result, false);
  assert.equal("trackingTokenHash" in result, false);
});

test("guest tracking hides orders when the private token is invalid", async () => {
  const service = new OrdersService({
    order: {
      findUnique: async () => ({
        trackingTokenHash: "0".repeat(64),
      }),
    },
  } as unknown as PrismaService);

  await assert.rejects(
    service.trackGuestOrder("ATV-2610-000001", "B".repeat(43)),
    NotFoundException,
  );
});