import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const product = {
  id: "product-1",
  slug: "test-camera",
  title: "Test Camera",
  description: "Catalog description <script>alert(1)</script>",
  condition: "NEW",
  category: { name: "Camera Gear", slug: "camera-gear" },
  brand: { name: "Example Brand", slug: "example-brand" },
  vendor: { name: "Example Seller" },
  price: { amount: "149900", currency: "PKR" },
  availability: "IN_STOCK",
  variants: [
    {
      id: "variant-1",
      price: { amount: "149900", currency: "PKR" },
      stock: 5,
    },
  ],
  images: [],
};
const categories = [
  {
    id: "category-1",
    name: "Camera Gear",
    slug: "camera-gear",
    description: "Cameras and related products.",
  },
];
const products = Array.from({ length: 21 }, (_, index) =>
  index === 0
    ? product
    : {
        ...product,
        id: `product-${index + 1}`,
        slug: `test-camera-${index + 1}`,
        title: `Test Camera ${index + 1}`,
      },
);
const brands = [
  { id: "brand-1", name: "Example Brand", slug: "example-brand" },
];
const productQueries = [];
let nextProcess;
let serverError = "";
let serverOutput = "";

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate a local test port.");
  }
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function respond(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const api = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/api/v1/products") {
    productQueries.push(url.searchParams);
    if (url.searchParams.get("q") === "offline") {
      respond(response, 503, { message: "unavailable" });
      return;
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    const total = products.length;
    respond(response, 200, {
      data: products.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
    return;
  }
  if (url.pathname === "/api/v1/products/test-camera") {
    respond(response, 200, { data: product });
    return;
  }
  if (url.pathname.startsWith("/api/v1/products/")) {
    respond(response, 404, { message: "not found" });
    return;
  }
  if (url.pathname === "/api/v1/categories") {
    respond(response, 200, { data: categories });
    return;
  }
  if (url.pathname === "/api/v1/brands") {
    respond(response, 200, { data: brands });
    return;
  }
  respond(response, 404, { message: "not found" });
});

async function getHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Googlebot" },
    signal: AbortSignal.timeout(10_000),
  });
  return { response, html: await response.text() };
}

function assertAccessibleShell(html, pageName) {
  assert.match(html, /href="#main-content">Skip to content<\/a>/, `${pageName}: skip link`);
  assert.match(html, /<main\b[^>]*id="main-content"/, `${pageName}: main landmark`);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${pageName}: one page heading`);
}

function contrastRatio(foreground, background) {
  function luminance(color) {
    const [red, green, blue] = color
      .match(/[0-9a-f]{2}/gi)
      .map((channel) => parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function checkStaticAccessibility() {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /:focus-visible/, "visible keyboard focus styles");
  assert.match(styles, /prefers-reduced-motion:\s*reduce/, "reduced-motion support");
  for (const breakpoint of [640, 767, 900, 1024, 1280]) {
    assert.ok(
      styles.includes(`max-width: ${breakpoint}px`) ||
        styles.includes(`min-width: ${breakpoint}px`),
      `responsive breakpoint ${breakpoint}px`,
    );
  }
  for (const [foreground, background, name] of [
    ["#64748b", "#ffffff", "light muted text on white"],
    ["#64748b", "#f8fafc", "light muted text on surface"],
    ["#94a3b8", "#0b1220", "dark muted text on background"],
    ["#94a3b8", "#111827", "dark muted text on surface"],
    ["#2563eb", "#ffffff", "light accent links"],
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} meets WCAG AA normal-text contrast`,
    );
  }
}

async function main() {
  const apiPort = await unusedPort();
  const webPort = await unusedPort();
  api.listen(apiPort, "127.0.0.1");
  await once(api, "listening");
  const baseUrl = `http://127.0.0.1:${webPort}`;
  try {
    nextProcess = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    {
      env: {
        ...process.env,
        API_BASE_URL: `http://127.0.0.1:${apiPort}/api/v1`,
        APP_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
    nextProcess.stderr.setEncoding("utf8");
    nextProcess.stderr.on("data", (chunk) => {
      serverError = `${serverError}${chunk}`.slice(-4000);
    });
    nextProcess.stdout.setEncoding("utf8");
    nextProcess.stdout.on("data", (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-4000);
    });

    let ready = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (nextProcess.exitCode !== null) {
        throw new Error(`Next.js exited before starting: ${serverError}`);
      }
      try {
        const response = await fetch(baseUrl, {
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(ready, `Next.js did not become ready: ${serverError}`);

    const listing = await getHtml(`${baseUrl}/products`);
    assert.equal(listing.response.status, 200);
    assertAccessibleShell(listing.html, "product listing");
    assert.match(listing.html, /Test Camera/);
    assert.match(listing.html, /Example Brand/);
    assert.match(listing.html, /In stock/);
    assert.match(listing.html.replaceAll("<!-- -->", ""), /Page\s+1\s+of\s+2/);
    assert.match(listing.html, /href="\/products\?page=2&amp;pageSize=20"/);
    assert.match(listing.html, /<form[^>]*method="get"/);
    assert.ok((listing.html.match(/<label\b/g) ?? []).length >= 7);
    assert.match(listing.html, /aria-label="Catalog filters"/);
    assert.match(listing.html, /aria-label="Product results"/);
    assert.match(listing.html, /rel="canonical" href="http:\/\/127\.0\.0\.1:/);
    const listingSchema = listing.html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(listingSchema, "listing CollectionPage and BreadcrumbList JSON-LD");
    assert.deepEqual(
      JSON.parse(listingSchema[1]).map((entry) => entry["@type"]),
      ["CollectionPage", "BreadcrumbList"],
    );

    const filtered = await getHtml(
      `${baseUrl}/products?q=camera&category=camera-gear&brand=example-brand&availability=in-stock&sort=price-asc&minPrice=100&maxPrice=500000`,
    );
    assert.equal(filtered.response.status, 200);
    assert.match(filtered.html, /Test Camera/);
    assert.match(filtered.html, /noindex/);
    const forwarded = productQueries.find((query) => query.get("q") === "camera");
    assert.ok(forwarded, "search query forwarded to the catalog API");
    for (const [key, value] of Object.entries({
      category: "camera-gear",
      brand: "example-brand",
      availability: "in-stock",
      sort: "price-asc",
      minPrice: "100",
      maxPrice: "500000",
    })) {
      assert.equal(forwarded.get(key), value, `${key} filter forwarded`);
    }

    const categoryIndex = await getHtml(`${baseUrl}/categories`);
    assert.equal(categoryIndex.response.status, 200);
    assertAccessibleShell(categoryIndex.html, "category index");
    assert.match(categoryIndex.html, /Camera Gear/);
    assert.match(categoryIndex.html, /href="\/categories\/camera-gear"/);

    const category = await getHtml(`${baseUrl}/categories/camera-gear`);
    assert.equal(category.response.status, 200);
    assertAccessibleShell(category.html, "category listing");
    assert.match(category.html, /<title>Camera Gear \| ATVOO<\/title>/);
    assert.match(category.html, /Test Camera/);
    assert.ok(
      productQueries.some((query) => query.get("category") === "camera-gear"),
      "category page filters its product API request",
    );

    const detail = await getHtml(`${baseUrl}/products/test-camera`);
    assert.equal(detail.response.status, 200);
    assertAccessibleShell(detail.html, "product detail");
    assert.match(detail.html, /<title>Test Camera \| ATVOO<\/title>/);
    assert.match(detail.html, /1,499/);
    assert.match(detail.html, /Out of stock|In stock/);
    assert.match(detail.html, /rel="canonical" href="http:\/\/127\.0\.0\.1:/);
    const productSchema = detail.html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(productSchema, "product and breadcrumb JSON-LD");
    assert.ok(productSchema[1].includes("\\u003cscript>alert(1)"));
    assert.doesNotMatch(productSchema[1], /<script>alert\(1\)/);
    const productJsonLd = JSON.parse(productSchema[1]);
    assert.equal(productJsonLd[0]["@type"], "Product");
    assert.equal(productJsonLd[0].offers.price, "1499.00");
    assert.equal(productJsonLd[0].offers.priceCurrency, "PKR");
    assert.equal(productJsonLd[1]["@type"], "BreadcrumbList");

    const missingProduct = await getHtml(`${baseUrl}/products/missing-item`);
    assert.ok([200, 404].includes(missingProduct.response.status));
    assert.match(missingProduct.html, /noindex/);
    assert.match(missingProduct.html, /NEXT_HTTP_ERROR_FALLBACK;404/);
    const missingCategory = await getHtml(
      `${baseUrl}/categories/missing-category`,
    );
    assert.ok([200, 404].includes(missingCategory.response.status));
    assert.match(missingCategory.html, /noindex/);
    assert.match(missingCategory.html, /NEXT_HTTP_ERROR_FALLBACK;404/);
    assert.match(missingCategory.html, /not found/i);

    const robots = await getHtml(`${baseUrl}/robots.txt`);
    assert.equal(robots.response.status, 200);
    assert.match(robots.html, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
    assert.match(robots.html, /User-Agent: GPTBot[\s\S]*Disallow: \//);
    assert.match(robots.html, /User-Agent: OAI-SearchBot[\s\S]*Allow: \//);

    const llms = await fetch(`${baseUrl}/llms.txt`);
    const llmsText = await llms.text();
    assert.equal(llms.status, 200);
    assert.match(llms.headers.get("content-type") ?? "", /text\/plain/);
    assert.match(llmsText, /Camera Gear/);
    assert.match(llmsText, /sitemap\.xml/);
    assert.match(llmsText, /checkout is not currently available/i);

    const sitemap = await getHtml(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemap.response.status, 200);
    assert.match(sitemap.html, /http:\/\/127\.0\.0\.1:\d+\/categories\/camera-gear/);
    assert.match(sitemap.html, /http:\/\/127\.0\.0\.1:\d+\/products\/test-camera/);

    const unavailable = await getHtml(`${baseUrl}/products?q=offline`);
    assert.equal(unavailable.response.status, 200);
    assert.match(unavailable.html, /We couldn.t load the catalog/);
    assert.match(unavailable.html, /Try again/);

    await checkStaticAccessibility();
    console.log(
      "Phase 2 storefront checks passed: server-rendered catalog, query filters, pagination, category routes, metadata/JSON-LD, streamed not-found handling, robots, llms.txt, sitemap, API retry state, keyboard/reduced-motion/responsive CSS, and color contrast.",
    );
  } finally {
    if (nextProcess && nextProcess.exitCode === null) {
      const exit = once(nextProcess, "exit");
      nextProcess.kill("SIGTERM");
      const exited = await Promise.race([
        exit.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
      ]);
      if (!exited) {
        const killed = once(nextProcess, "exit");
        nextProcess.kill("SIGKILL");
        await killed;
      }
    }
    api.closeAllConnections();
    if (api.listening) {
      await new Promise((resolve, reject) =>
        api.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
