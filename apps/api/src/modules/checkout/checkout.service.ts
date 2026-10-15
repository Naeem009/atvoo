import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { CheckoutDestination } from "./checkout-query";
import {
  calculateLineTax,
  calculateShippingAmount,
  type ShippingRateInput,
  type TaxTreatmentInput,
} from "./checkout-pricing";
import { PrismaService } from "../database/prisma.service";

const quoteMinutes = 10;

const checkoutCartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      productVariant: {
        select: {
          id: true,
          vendorId: true,
          sku: true,
          status: true,
          price: true,
          currency: true,
          stock: true,
          weightGrams: true,
          deletedAt: true,
          product: {
            select: {
              title: true,
              status: true,
              approvalStatus: true,
              deletedAt: true,
              vendor: { select: { status: true, deletedAt: true } },
              category: { select: { taxClass: true, isActive: true } },
              brand: { select: { isActive: true } },
              images: { take: 1, select: { id: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CheckoutCart = Prisma.CartGetPayload<{
  include: typeof checkoutCartInclude;
}>;
type CheckoutLine = CheckoutCart["items"][number]["productVariant"];

type QuoteLineSnapshot = {
  variantId: string;
  vendorId: string;
  title: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  currency: string;
  taxClass: string;
  taxRateBps: number;
  taxTreatment: TaxTreatmentInput;
  subtotal: string;
  netSubtotal: string;
  taxAmount: string;
  total: string;
  weightGrams: number | null;
};

type QuoteShipmentSnapshot = {
  vendorId: string;
  profileId: string;
  rateId: string;
  carrierName: string;
  shippingTaxClass: string;
  shippingTaxRateBps: number;
  shippingTaxTreatment: TaxTreatmentInput;
  baseAmount: string;
  netAmount: string;
  taxAmount: string;
  total: string;
  handlingDays: number;
  transitDays: number;
  codAllowed: boolean;
};

type QuoteSnapshot = {
  cartId: string;
  destination: CheckoutDestination;
  currency: string;
  lines: QuoteLineSnapshot[];
  shipments: QuoteShipmentSnapshot[];
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  total: string;
};

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuote(sessionId: string, destination: CheckoutDestination) {
    const now = new Date();
    const cart = await this.prisma.cart.findFirst({
      where: { sessionId, expiresAt: { gt: now } },
      include: checkoutCartInclude,
    });
    if (!cart) throw this.notFound("The cart session is unavailable.");
    if (cart.items.length === 0) throw this.conflict("The cart is empty.");

    const lines = cart.items.map((item) => ({
      cartItem: item,
      variant: item.productVariant,
    }));
    this.assertSellable(lines.map(({ variant }) => variant));
    const availableByVariant = await this.availableStock(
      lines.map(({ variant }) => variant),
      now,
    );
    for (const { cartItem, variant } of lines) {
      if (cartItem.quantity > (availableByVariant.get(variant.id) ?? 0)) {
        throw this.conflict("Stock changed. Refresh your cart and try again.");
      }
      if (
        cartItem.unitPrice !== variant.price ||
        cartItem.currency.trim() !== variant.currency.trim()
      ) {
        throw new ConflictException({
          error: {
            code: "PRICE_CHANGED",
            message: "A product price changed. Refresh your cart and try again.",
          },
        });
      }
      if (variant.currency.trim() !== "PKR") {
        throw this.unavailable("Checkout is not configured for this currency.");
      }
    }

    const classes = new Set<string>();
    for (const { variant } of lines) {
      const taxClass = variant.product.category.taxClass?.trim();
      if (!taxClass) throw this.unavailable("A product tax class is not configured.");
      classes.add(taxClass);
    }
    const vendorIds = [...new Set(lines.map(({ variant }) => variant.vendorId))];
    const profiles = await this.loadShippingProfiles(vendorIds, destination);
    for (const vendorId of vendorIds) {
      const profile = profiles.get(vendorId);
      if (!profile) throw this.unavailable("Shipping is not configured for this cart.");
      classes.add(profile.shippingTaxClass);
    }
    const taxRates = await this.loadTaxRates([...classes], destination, now);

    const quoteLines = lines.map(({ cartItem, variant }) => {
      const taxClass = variant.product.category.taxClass?.trim();
      if (!taxClass) throw this.unavailable("A product tax class is not configured.");
      const taxRate = taxRates.get(taxClass);
      if (!taxRate) throw this.unavailable(`No active tax rate is configured for ${taxClass}.`);
      const subtotal = variant.price * BigInt(cartItem.quantity);
      const taxAmount = calculateLineTax(
        subtotal,
        taxRate.rateBps,
        taxRate.treatment,
      );
      const netSubtotal =
        taxRate.treatment === "INCLUSIVE" ? subtotal - taxAmount : subtotal;
      const total =
        taxRate.treatment === "INCLUSIVE" ? subtotal : subtotal + taxAmount;
      return {
        variantId: variant.id,
        vendorId: variant.vendorId,
        title: variant.product.title,
        sku: variant.sku,
        quantity: cartItem.quantity,
        unitPrice: variant.price.toString(),
        currency: variant.currency.trim(),
        taxClass,
        taxRateBps: taxRate.rateBps,
        taxTreatment: taxRate.treatment,
        subtotal: subtotal.toString(),
        netSubtotal: netSubtotal.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        weightGrams: variant.weightGrams,
      } satisfies QuoteLineSnapshot;
    });

    const quoteShipments = this.priceShipments(
      vendorIds,
      quoteLines,
      profiles,
      taxRates,
    );
    const subtotal = sumStrings(quoteLines.map((line) => line.netSubtotal));
    const shippingTotal = sumStrings(
      quoteShipments.map((shipment) => shipment.netAmount),
    );
    const taxTotal = sumStrings([
      ...quoteLines.map((line) => line.taxAmount),
      ...quoteShipments.map((shipment) => shipment.taxAmount),
    ]);
    const total = BigInt(subtotal) + BigInt(shippingTotal) + BigInt(taxTotal);
    const snapshot: QuoteSnapshot = {
      cartId: cart.id,
      destination,
      currency: "PKR",
      lines: quoteLines,
      shipments: quoteShipments,
      subtotal,
      shippingTotal,
      taxTotal,
      total: total.toString(),
    };
    const expiresAt = new Date(now.getTime() + quoteMinutes * 60_000);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");
    const quote = await this.prisma.checkoutQuote.create({
      data: {
        cartId: cart.id,
        requestHash,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
      select: { id: true },
    });

    return {
      quoteId: quote.id,
      expiresAt: expiresAt.toISOString(),
      currency: snapshot.currency,
      destination: snapshot.destination,
      lines: snapshot.lines,
      shipments: snapshot.shipments,
      totals: {
        subtotal: snapshot.subtotal,
        shipping: snapshot.shippingTotal,
        tax: snapshot.taxTotal,
        total: snapshot.total,
      },
    };
  }

  private assertSellable(variants: CheckoutLine[]): void {
    for (const variant of variants) {
      const product = variant.product;
      if (
        variant.status !== "ACTIVE" ||
        variant.deletedAt !== null ||
        product.status !== "ACTIVE" ||
        !["APPROVED", "AUTO_APPROVED"].includes(product.approvalStatus) ||
        product.deletedAt !== null ||
        product.vendor.status !== "APPROVED" ||
        product.vendor.deletedAt !== null ||
        !product.category.isActive ||
        product.brand?.isActive !== true ||
        product.images.length === 0
      ) {
        throw this.conflict("A cart product is no longer available.");
      }
    }
  }

  private async availableStock(
    variants: CheckoutLine[],
    now: Date,
  ): Promise<Map<string, number>> {
    const reservations = await this.prisma.stockReservation.groupBy({
      by: ["productVariantId"],
      where: {
        productVariantId: { in: variants.map((variant) => variant.id) },
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    });
    const reserved = new Map(
      reservations.map((row) => [row.productVariantId, row._sum.quantity ?? 0]),
    );
    return new Map(
      variants.map((variant) => [
        variant.id,
        Math.max(0, variant.stock - (reserved.get(variant.id) ?? 0)),
      ]),
    );
  }

  private async loadTaxRates(
    taxClasses: string[],
    destination: CheckoutDestination,
    now: Date,
  ) {
    const rates = await this.prisma.taxRate.findMany({
      where: {
        countryCode: destination.countryCode,
        province: destination.province,
        taxClass: { in: taxClasses },
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
    });
    const byClass = new Map<string, (typeof rates)[number]>();
    for (const rate of rates) {
      if (!byClass.has(rate.taxClass)) byClass.set(rate.taxClass, rate);
    }
    return new Map(
      [...byClass].map(([taxClass, rate]) => [
        taxClass,
        { id: rate.id, rateBps: rate.rateBps, treatment: rate.treatment },
      ]),
    );
  }

  private async loadShippingProfiles(
    vendorIds: string[],
    destination: CheckoutDestination,
  ) {
    const profiles = await this.prisma.shippingProfile.findMany({
      where: {
        vendorId: { in: vendorIds },
        isActive: true,
        zones: {
          some: {
            province: destination.province,
            city: destination.city,
            rate: { isNot: null },
          },
        },
      },
      include: {
        zones: {
          where: {
            province: destination.province,
            city: destination.city,
          },
          include: { rate: true },
        },
      },
    });
    const byVendor = new Map<string, (typeof profiles)[number]>();
    for (const profile of profiles) {
      const zone = profile.zones.find((entry) => entry.rate !== null);
      if (!zone) continue;
      if (byVendor.has(profile.vendorId)) {
        throw this.conflict("A vendor has multiple shipping profiles for this destination.");
      }
      byVendor.set(profile.vendorId, profile);
    }
    for (const vendorId of vendorIds) {
      if (!byVendor.has(vendorId)) {
        throw this.unavailable("Shipping is not configured for this cart destination.");
      }
    }
    return byVendor;
  }

  private priceShipments(
    vendorIds: string[],
    lines: QuoteLineSnapshot[],
    profiles: Awaited<ReturnType<CheckoutService["loadShippingProfiles"]>>,
    taxRates: Awaited<ReturnType<CheckoutService["loadTaxRates"]>>,
  ): QuoteShipmentSnapshot[] {
    return vendorIds.map((vendorId) => {
      const profile = profiles.get(vendorId);
      const zone = profile?.zones.find((entry) => entry.rate !== null);
      const rate = zone?.rate;
      if (!profile || !zone || !rate) {
        throw this.unavailable("Shipping is not configured for this cart destination.");
      }
      const shippingRate = this.toShippingRate(rate);
      const vendorLines = lines.filter((line) => line.vendorId === vendorId);
      const vendorSubtotal = vendorLines.reduce(
        (sum, line) => sum + BigInt(line.subtotal),
        0n,
      );
      const totalWeightGrams = vendorLines.reduce((sum, line) => {
        if (line.weightGrams === null) {
          if (shippingRate.type === "WEIGHT_BASED") {
            throw this.unavailable("Product weight is required for this shipping rate.");
          }
          return sum;
        }
        return sum + BigInt(line.weightGrams) * BigInt(line.quantity);
      }, 0n);
      const baseAmount = calculateShippingAmount(
        vendorSubtotal,
        totalWeightGrams,
        shippingRate,
      );
      const shippingTax = taxRates.get(profile.shippingTaxClass);
      if (!shippingTax) {
        throw this.unavailable("No active shipping tax rate is configured.");
      }
      const taxAmount = calculateLineTax(
        baseAmount,
        shippingTax.rateBps,
        shippingTax.treatment,
      );
      const netAmount =
        shippingTax.treatment === "INCLUSIVE"
          ? baseAmount - taxAmount
          : baseAmount;
      const total =
        shippingTax.treatment === "INCLUSIVE"
          ? baseAmount
          : baseAmount + taxAmount;
      return {
        vendorId,
        profileId: profile.id,
        rateId: rate.id,
        carrierName: profile.carrierName,
        shippingTaxClass: profile.shippingTaxClass,
        shippingTaxRateBps: shippingTax.rateBps,
        shippingTaxTreatment: shippingTax.treatment,
        baseAmount: baseAmount.toString(),
        netAmount: netAmount.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        handlingDays: profile.handlingDays,
        transitDays: profile.transitDays,
        codAllowed: profile.codAllowed,
      };
    });
  }

  private toShippingRate(rate: {
    type: "FLAT" | "FREE_OVER_THRESHOLD" | "WEIGHT_BASED";
    amount: bigint | null;
    freeAboveAmount: bigint | null;
    baseAmount: bigint | null;
    amountPerKilogram: bigint | null;
  }): ShippingRateInput {
    if (rate.type === "FLAT" && rate.amount !== null) {
      return { type: "FLAT", amount: rate.amount };
    }
    if (
      rate.type === "FREE_OVER_THRESHOLD" &&
      rate.amount !== null &&
      rate.freeAboveAmount !== null
    ) {
      return {
        type: "FREE_OVER_THRESHOLD",
        amount: rate.amount,
        freeAboveAmount: rate.freeAboveAmount,
      };
    }
    if (
      rate.type === "WEIGHT_BASED" &&
      rate.baseAmount !== null &&
      rate.amountPerKilogram !== null
    ) {
      return {
        type: "WEIGHT_BASED",
        baseAmount: rate.baseAmount,
        amountPerKilogram: rate.amountPerKilogram,
      };
    }
    throw this.unavailable("A shipping rate is invalid.");
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ error: { code: "CONFLICT", message } });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ error: { code: "NOT_FOUND", message } });
  }

  private unavailable(message: string): ServiceUnavailableException {
    return new ServiceUnavailableException({
      error: { code: "DEPENDENCY_UNAVAILABLE", message },
    });
  }
}

function sumStrings(values: string[]): string {
  return values.reduce((sum, value) => sum + BigInt(value), 0n).toString();
}