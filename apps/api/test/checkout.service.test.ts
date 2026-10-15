import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import type { PrismaService } from "../src/modules/database/prisma.service";
import { CheckoutService } from "../src/modules/checkout/checkout.service";

const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const variantId = "123e4567-e89b-42d3-a456-426614174001";
const vendorId = "123e4567-e89b-42d3-a456-426614174002";
const cartId = "123e4567-e89b-42d3-a456-426614174003";

function createFixture(options?: {
  reserved?: number;
  price?: bigint;
  includeShippingProfile?: boolean;
}) {
  const now = new Date();
  const cart = {
    id: cartId,
    expiresAt: new Date(now.getTime() + 60_000),
    items: [
      {
        quantity: 1,
        unitPrice: 1_100n,
        currency: "PKR",
        productVariant: {
          id: variantId,
          vendorId,
          sku: "SKU-1",
          status: "ACTIVE",
          price: options?.price ?? 1_100n,
          currency: "PKR",
          stock: 5,
          weightGrams: 500,
          deletedAt: null,
          product: {
            title: "Test item",
            status: "ACTIVE",
            approvalStatus: "APPROVED",
            deletedAt: null,
            vendor: { status: "APPROVED", deletedAt: null },
            category: { taxClass: "general", isActive: true },
            brand: { isActive: true },
            images: [{ id: "image" }],
          },
        },
      },
    ],
  };
  const shippingProfiles = options?.includeShippingProfile === false
    ? []
    : [
        {
          id: "profile-1",
          vendorId,
          carrierName: "Local carrier",
          shippingTaxClass: "delivery",
          handlingDays: 1,
          transitDays: 2,
          codAllowed: true,
          zones: [
            {
              rate: {
                id: "rate-1",
                type: "FLAT",
                amount: 200n,
                freeAboveAmount: null,
                baseAmount: null,
                amountPerKilogram: null,
              },
            },
          ],
        },
      ];
  const taxRates = [
    {
      id: "tax-product",
      taxClass: "general",
      rateBps: 1_000,
      treatment: "INCLUSIVE",
    },
    {
      id: "tax-shipping",
      taxClass: "delivery",
      rateBps: 1_000,
      treatment: "EXCLUSIVE",
    },
  ];
  const quoteCreateCalls: unknown[] = [];
  const prisma = {
    cart: { findFirst: async () => cart },
    stockReservation: {
      groupBy: async () =>
        (options?.reserved ?? 0) > 0
          ? [{ productVariantId: variantId, _sum: { quantity: options?.reserved } }]
          : [],
    },
    shippingProfile: { findMany: async () => shippingProfiles },
    taxRate: { findMany: async () => taxRates },
    checkoutQuote: {
      create: async (input: unknown) => {
        quoteCreateCalls.push(input);
        return { id: "quote-1" };
      },
    },
  };
  return {
    service: new CheckoutService(prisma as unknown as PrismaService),
    quoteCreateCalls,
  };
}

test("checkout quote uses configured item/shipping taxes and stores a snapshot", async () => {
  const { service, quoteCreateCalls } = createFixture();
  const quote = await service.createQuote(sessionId, {
    province: "Punjab",
    city: "Lahore",
    countryCode: "PK",
  });

  assert.equal(quote.quoteId, "quote-1");
  assert.deepEqual(quote.totals, {
    subtotal: "1000",
    shipping: "200",
    tax: "120",
    total: "1320",
  });
  assert.equal(quote.lines[0]?.total, "1100");
  assert.equal(quote.shipments[0]?.total, "220");
  assert.equal(quoteCreateCalls.length, 1);
});

test("checkout quote rejects stock already held by active reservations", async () => {
  const { service, quoteCreateCalls } = createFixture({ reserved: 5 });
  await assert.rejects(
    service.createQuote(sessionId, {
      province: "Punjab",
      city: "Lahore",
      countryCode: "PK",
    }),
    ConflictException,
  );
  assert.equal(quoteCreateCalls.length, 0);
});

test("checkout quote rejects a cart price that differs from current catalog price", async () => {
  const { service, quoteCreateCalls } = createFixture({ price: 1_200n });
  await assert.rejects(
    service.createQuote(sessionId, {
      province: "Punjab",
      city: "Lahore",
      countryCode: "PK",
    }),
    ConflictException,
  );
  assert.equal(quoteCreateCalls.length, 0);
});

test("checkout quote refuses to guess when shipping configuration is missing", async () => {
  const { service, quoteCreateCalls } = createFixture({
    includeShippingProfile: false,
  });
  await assert.rejects(
    service.createQuote(sessionId, {
      province: "Punjab",
      city: "Lahore",
      countryCode: "PK",
    }),
    ServiceUnavailableException,
  );
  assert.equal(quoteCreateCalls.length, 0);
});