import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { parseCatalogQuery } from "../src/modules/catalog/catalog-query";
import {
  parseAddCartItem,
  parseCartItemId,
  parseCartItemQuantity,
  parseCartSession,
} from "../src/modules/cart/cart-query";

test("catalog queries apply safe pagination defaults", () => {
  assert.deepEqual(parseCatalogQuery({}), {
    page: 1,
    pageSize: 20,
    availability: "all",
    sort: "newest",
  });
});

test("catalog queries parse supported filters", () => {
  assert.deepEqual(
    parseCatalogQuery({
      page: "2",
      pageSize: "50",
      q: "linen shirt",
      category: "fashion-men",
      brand: "unbranded",
      vendorId: "123e4567-e89b-42d3-a456-426614174001",
      minPrice: "100",
      maxPrice: "5000",
      availability: "in-stock",
      sort: "relevance",
    }),
    {
      page: 2,
      pageSize: 50,
      q: "linen shirt",
      category: "fashion-men",
      brand: "unbranded",
      vendorId: "123e4567-e89b-42d3-a456-426614174001",
      minPrice: 100,
      maxPrice: 5000,
      availability: "in-stock",
      sort: "relevance",
    },
  );
});

test("catalog queries reject unknown parameters and unbounded pages", () => {
  for (const input of [
    { status: "DRAFT" },
    { pageSize: "101" },
    { page: "10001" },
    { page: "0" },
    { minPrice: " " },
    { minPrice: "500", maxPrice: "100" },
    { q: "a" },
    { sort: "relevance" },
  ]) {
    assert.throws(() => parseCatalogQuery(input), HttpException);
  }
});

test("catalog browse accepts supplier and popularity filters", () => {
  assert.deepEqual(
    parseCatalogQuery({
      vendorId: "123e4567-e89b-42d3-a456-426614174001",
      sort: "popular",
    }),
    {
      page: 1,
      pageSize: 20,
      vendorId: "123e4567-e89b-42d3-a456-426614174001",
      availability: "all",
      sort: "popular",
    },
  );
  assert.throws(
    () => parseCatalogQuery({ vendorId: "supplier-name" }),
    HttpException,
  );
  assert.throws(
    () => parseCatalogQuery({ q: "camera", sort: "popular" }),
    HttpException,
  );
});

test("guest-cart input accepts UUID sessions and bounded variant quantities", () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(parseCartSession(undefined), undefined);
  assert.equal(parseCartSession(sessionId), sessionId);
  assert.deepEqual(parseAddCartItem({ variantId: sessionId, quantity: 3 }), {
    variantId: sessionId,
    quantity: 3,
  });
  assert.equal(parseCartItemId(sessionId), sessionId);
  assert.equal(parseCartItemQuantity({ quantity: 10 }), 10);
});

test("guest-cart input rejects invalid sessions, IDs, quantities, and extra fields", () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174000";
  for (const operation of [
    () => parseCartSession("not-a-uuid"),
    () => parseCartItemId("not-a-uuid"),
    () => parseAddCartItem({ variantId: sessionId, quantity: 0 }),
    () => parseAddCartItem({ variantId: sessionId, quantity: 11 }),
    () => parseAddCartItem({ variantId: sessionId, quantity: 1, price: 1 }),
    () => parseCartItemQuantity({ quantity: 1.5 }),
    () => parseCartItemQuantity({ quantity: 1, cartId: sessionId }),
  ]) {
    assert.throws(operation, HttpException);
  }
});
