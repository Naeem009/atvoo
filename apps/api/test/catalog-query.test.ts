import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { parseCatalogQuery } from "../src/modules/catalog/catalog-query";

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
