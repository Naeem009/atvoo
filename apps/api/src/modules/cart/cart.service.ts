import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { calculateAvailableStock } from "../orders/inventory";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      productVariant: {
        select: {
          id: true,
          status: true,
          price: true,
          currency: true,
          stock: true,
          deletedAt: true,
          product: {
            select: {
              title: true,
              slug: true,
              status: true,
              approvalStatus: true,
              deletedAt: true,
              vendor: {
                select: { displayName: true, status: true, deletedAt: true },
              },
              category: { select: { name: true, slug: true, isActive: true } },
              brand: { select: { isActive: true } },
              images: {
                orderBy: [
                  { isPrimary: "desc" as const },
                  { displayOrder: "asc" as const },
                ],
                take: 1,
                select: { storagePath: true, altText: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type TransactionClient = Prisma.TransactionClient;
type SellableVariant = {
  id: string;
  price: bigint;
  currency: string;
  stock: number;
};

const cartTtlMilliseconds = 30 * 24 * 60 * 60 * 1000;
const maxCartLines = 50;
const maxQuantityPerLine = 10;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCart(sessionId?: string) {
    const resolvedSessionId = sessionId ?? randomUUID();
    try {
      const cartId = await this.ensureCart(resolvedSessionId);
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: cartInclude,
      });
      if (!cart) {
        throw new ServiceUnavailableException({
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "The cart could not be loaded.",
          },
        });
      }
      const variantIds = cart.items.map((item) => item.productVariant.id);
      const reservations = variantIds.length
        ? await this.prisma.stockReservation.groupBy({
            by: ["productVariantId"],
            where: {
              productVariantId: { in: variantIds },
              status: "ACTIVE",
              expiresAt: { gt: new Date() },
            },
            _sum: { quantity: true },
          })
        : [];
      const reservedByVariant = new Map(
        reservations.map((reservation) => [
          reservation.productVariantId,
          reservation._sum.quantity ?? 0,
        ]),
      );
      return {
        sessionId: resolvedSessionId,
        data: this.serializeCart(cart, reservedByVariant),
      };
    } catch (error) {
      this.handleDatabaseError(error, "Could not load the guest cart.");
    }
  }

  async addItem(sessionId: string | undefined, variantId: string, quantity: number) {
    const resolvedSessionId = sessionId ?? randomUUID();
    try {
      const cartId = await this.ensureCart(resolvedSessionId);
      await this.prisma.$transaction(
        async (transaction) => {
          const cart = await transaction.cart.findUnique({
            where: { id: cartId },
            select: { id: true, expiresAt: true },
          });
          if (!cart || cart.expiresAt <= new Date()) {
            throw this.notFound("Cart session expired. Start a new cart.");
          }
          const variant = await this.findSellableVariant(transaction, variantId);
          if (!variant) throw this.notFound("This product is no longer available.");

          const existing = await transaction.cartItem.findUnique({
            where: {
              cartId_productVariantId: { cartId, productVariantId: variantId },
            },
            select: { id: true, quantity: true },
          });
          const nextQuantity = (existing?.quantity ?? 0) + quantity;
          this.assertQuantity(nextQuantity, variant.stock);
          if (!existing) {
            const lineCount = await transaction.cartItem.count({
              where: { cartId },
            });
            if (lineCount >= maxCartLines) {
              throw this.conflict("A cart can contain at most 50 products.");
            }
          }

          await transaction.cartItem.upsert({
            where: {
              cartId_productVariantId: { cartId, productVariantId: variantId },
            },
            create: {
              cartId,
              productVariantId: variant.id,
              quantity: nextQuantity,
              unitPrice: variant.price,
              currency: variant.currency,
            },
            update: {
              quantity: nextQuantity,
              unitPrice: variant.price,
              currency: variant.currency,
            },
          });
          await transaction.cart.update({
            where: { id: cartId },
            data: { expiresAt: this.expiryDate() },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getCart(resolvedSessionId);
    } catch (error) {
      this.handleDatabaseError(error, "Could not add the product to the cart.");
    }
  }

  async updateItem(
    sessionId: string | undefined,
    itemId: string,
    quantity: number,
  ) {
    const resolvedSessionId = sessionId ?? randomUUID();
    try {
      const cartId = await this.ensureCart(resolvedSessionId);
      await this.prisma.$transaction(
        async (transaction) => {
          const item = await transaction.cartItem.findFirst({
            where: { id: itemId, cartId },
            select: { id: true, productVariantId: true },
          });
          if (!item) throw this.notFound("Cart item not found.");
          const variant = await this.findSellableVariant(
            transaction,
            item.productVariantId,
          );
          if (!variant) throw this.notFound("This product is no longer available.");
          this.assertQuantity(quantity, variant.stock);
          await transaction.cartItem.update({
            where: { id: item.id },
            data: {
              quantity,
              unitPrice: variant.price,
              currency: variant.currency,
            },
          });
          await transaction.cart.update({
            where: { id: cartId },
            data: { expiresAt: this.expiryDate() },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getCart(resolvedSessionId);
    } catch (error) {
      this.handleDatabaseError(error, "Could not update the cart item.");
    }
  }

  async removeItem(sessionId: string | undefined, itemId: string) {
    const resolvedSessionId = sessionId ?? randomUUID();
    try {
      const cartId = await this.ensureCart(resolvedSessionId);
      await this.prisma.$transaction(
        async (transaction) => {
          await transaction.cartItem.deleteMany({
            where: { id: itemId, cartId },
          });
          await transaction.cart.update({
            where: { id: cartId },
            data: { expiresAt: this.expiryDate() },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getCart(resolvedSessionId);
    } catch (error) {
      this.handleDatabaseError(error, "Could not remove the cart item.");
    }
  }

  private async ensureCart(sessionId: string): Promise<string> {
    const now = new Date();
    let cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      select: { id: true, expiresAt: true },
    });
    if (cart && cart.expiresAt > now) return cart.id;
    if (cart) {
      await this.prisma.cart.deleteMany({
        where: { id: cart.id, expiresAt: { lte: now } },
      });
    }

    try {
      cart = await this.prisma.cart.create({
        data: { sessionId, expiresAt: this.expiryDate() },
        select: { id: true, expiresAt: true },
      });
      return cart.id;
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const concurrentCart = await this.prisma.cart.findUnique({
          where: { sessionId },
          select: { id: true, expiresAt: true },
        });
        if (concurrentCart && concurrentCart.expiresAt > new Date()) {
          return concurrentCart.id;
        }
      }
      throw error;
    }
  }

  private async findSellableVariant(
    transaction: TransactionClient,
    variantId: string,
  ): Promise<SellableVariant | null> {
    const variant = await transaction.productVariant.findFirst({
      where: {
        id: variantId,
        status: "ACTIVE",
        deletedAt: null,
        product: {
          status: "ACTIVE",
          approvalStatus: { in: ["APPROVED", "AUTO_APPROVED"] },
          deletedAt: null,
          vendor: { status: "APPROVED", deletedAt: null },
          category: { isActive: true },
          brand: { isActive: true },
          images: { some: {} },
        },
      },
      select: { id: true, price: true, currency: true, stock: true },
    });
    if (!variant) return null;
    const reservations = await transaction.stockReservation.aggregate({
      where: {
        productVariantId: variant.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });
    return {
      ...variant,
      currency: variant.currency.trim(),
      stock: calculateAvailableStock(
        variant.stock,
        reservations._sum.quantity ?? 0,
      ),
    };
  }

  private serializeCart(
    cart: CartWithItems,
    reservedByVariant: ReadonlyMap<string, number>,
  ) {
    const totals = new Map<string, bigint>();
    const items = cart.items.map((item) => {
      const variant = item.productVariant;
      const product = variant.product;
      const availableStock = calculateAvailableStock(
        variant.stock,
        reservedByVariant.get(variant.id) ?? 0,
      );
      const sellable =
        variant.status === "ACTIVE" &&
        variant.deletedAt === null &&
        product.status === "ACTIVE" &&
        (product.approvalStatus === "APPROVED" ||
          product.approvalStatus === "AUTO_APPROVED") &&
        product.deletedAt === null &&
        product.vendor.status === "APPROVED" &&
        product.vendor.deletedAt === null &&
        product.category.isActive &&
        product.brand?.isActive === true &&
        product.images.length > 0;
      const currency = variant.currency.trim();
      const priceChanged =
        item.unitPrice !== variant.price || item.currency.trim() !== currency;
      const warnings: string[] = [];
      if (!sellable) warnings.push("This product is no longer available.");
      if (availableStock < item.quantity) {
        warnings.push(
          availableStock > 0
            ? `Only ${availableStock} remain in stock.`
            : "This product is out of stock.",
        );
      }
      if (priceChanged) warnings.push("The price changed since you added it.");
      const lineTotal = variant.price * BigInt(item.quantity);
      totals.set(currency, (totals.get(currency) ?? 0n) + lineTotal);
      return {
        id: item.id,
        variantId: variant.id,
        title: product.title,
        slug: product.slug,
        vendor: product.vendor.displayName,
        category: product.category.name,
        image: product.images[0]
          ? {
              path: product.images[0].storagePath,
              alt: product.images[0].altText,
            }
          : null,
        quantity: item.quantity,
        stock: availableStock,
        available: sellable && availableStock >= item.quantity,
        warnings,
        price: { amount: variant.price.toString(), currency },
        previousPrice: priceChanged
          ? {
              amount: item.unitPrice.toString(),
              currency: item.currency.trim(),
            }
          : null,
        lineTotal: { amount: lineTotal.toString(), currency },
      };
    });
    return {
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      totals: [...totals].map(([currency, amount]) => ({
        currency,
        amount: amount.toString(),
      })),
      expiresAt: cart.expiresAt.toISOString(),
    };
  }

  private assertQuantity(quantity: number, stock: number): void {
    if (quantity > maxQuantityPerLine || quantity > stock) {
      throw this.conflict(
        `Requested quantity exceeds the available limit of ${Math.min(stock, maxQuantityPerLine)}.`,
      );
    }
  }

  private expiryDate(): Date {
    return new Date(Date.now() + cartTtlMilliseconds);
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ error: { code: "CONFLICT", message } });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ error: { code: "NOT_FOUND", message } });
  }

  private handleDatabaseError(error: unknown, message: string): never {
    if (error instanceof HttpException) throw error;
    if (isPrismaError(error, "P2034")) {
      throw this.conflict(
        "The cart changed during this request. Refresh the cart and try again.",
      );
    }
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    this.logger.error(`${message} ${detail.replace(/[\r\n\t]/g, " ").slice(0, 500)}`);
    throw new ServiceUnavailableException({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The cart service is temporarily unavailable.",
      },
    });
  }
}

function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}
