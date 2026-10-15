"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../database/prisma.service");
const inventory_1 = require("../orders/inventory");
const endpoint = "POST /api/v1/orders/create";
const idempotencyTtlMilliseconds = 24 * 60 * 60 * 1000;
const reservationTtlMilliseconds = 15 * 60 * 1000;
const maximumOrderSequence = 2176782335n;
const orderCartInclude = {
    items: {
        orderBy: { createdAt: "asc" },
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
                    deletedAt: true,
                    product: {
                        select: {
                            title: true,
                            status: true,
                            approvalStatus: true,
                            deletedAt: true,
                            vendor: { select: { status: true, deletedAt: true } },
                            category: { select: { isActive: true } },
                            brand: { select: { isActive: true } },
                            images: { take: 1, select: { id: true } },
                        },
                    },
                },
            },
        },
    },
};
let OrdersService = class OrdersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createGuestOrder(sessionId, idempotencyKey, input) {
        const now = new Date();
        const requestHash = hashRequest({ sessionId, input });
        const prior = await this.findIdempotencyRecord(idempotencyKey, now);
        if (prior) {
            return {
                data: this.replayOrReject(prior, requestHash),
                replayed: true,
            };
        }
        try {
            const transactionResult = await this.prisma.$transaction(async (transaction) => {
                const concurrent = await transaction.idempotencyKey.findUnique({
                    where: { endpoint_key: { endpoint, key: idempotencyKey } },
                });
                if (concurrent && concurrent.expiresAt > now) {
                    return {
                        response: this.replayOrReject(concurrent, requestHash),
                        replayed: true,
                    };
                }
                if (concurrent) {
                    await transaction.idempotencyKey.delete({ where: { id: concurrent.id } });
                }
                const quote = await transaction.checkoutQuote.findUnique({
                    where: { id: input.quoteId },
                    include: { cart: { include: orderCartInclude } },
                });
                if (!quote ||
                    quote.cart.sessionId !== sessionId ||
                    quote.expiresAt <= now ||
                    quote.consumedAt !== null) {
                    throw this.conflict("The checkout quote expired or was already used.");
                }
                const snapshot = parseQuoteSnapshot(quote.snapshot);
                if (snapshot.cartId !== quote.cartId || quote.cart.expiresAt <= now) {
                    throw this.conflict("The cart changed. Create a new checkout quote.");
                }
                this.assertAddressMatches(snapshot, input);
                this.assertCartMatches(snapshot, quote.cart);
                await this.assertCurrentStock(transaction, quote.cart, snapshot, now);
                const quoteUse = await transaction.checkoutQuote.updateMany({
                    where: { id: quote.id, consumedAt: null, expiresAt: { gt: now } },
                    data: { consumedAt: now },
                });
                if (quoteUse.count !== 1) {
                    throw this.conflict("The checkout quote expired or was already used.");
                }
                const orderNumber = await this.allocateOrderNumber(transaction, now);
                const trackingToken = (0, node_crypto_1.randomBytes)(32).toString("base64url");
                const trackingTokenHash = hashRequest(trackingToken);
                const reservationExpiresAt = new Date(now.getTime() + reservationTtlMilliseconds);
                const order = await transaction.order.create({
                    data: {
                        orderNumber,
                        trackingTokenHash,
                        buyerEmail: input.buyerEmail,
                        buyerPhone: input.buyerPhone,
                        recipientName: input.recipientName,
                        shippingAddressLine1: input.addressLine1,
                        shippingAddressLine2: input.addressLine2 ?? null,
                        shippingCity: snapshot.destination.city,
                        shippingProvince: snapshot.destination.province,
                        shippingPostalCode: input.postalCode ?? null,
                        shippingCountryCode: snapshot.destination.countryCode,
                        currency: snapshot.currency,
                        subtotal: BigInt(snapshot.subtotal),
                        shippingTotal: BigInt(snapshot.shippingTotal),
                        taxTotal: BigInt(snapshot.taxTotal),
                        total: BigInt(snapshot.total),
                        status: client_1.OrderStatus.PENDING_PAYMENT,
                        statusHistory: {
                            create: {
                                orderStatus: client_1.OrderStatus.PENDING_PAYMENT,
                                reason: "Guest checkout order created.",
                            },
                        },
                    },
                    select: { id: true, orderNumber: true, status: true },
                });
                const shipments = new Map();
                for (const shipmentSnapshot of snapshot.shipments) {
                    const shipment = await transaction.shipment.create({
                        data: {
                            orderId: order.id,
                            vendorId: shipmentSnapshot.vendorId,
                            status: client_1.ShipmentStatus.PENDING,
                            shippingAmount: BigInt(shipmentSnapshot.shippingAmount),
                            taxAmount: BigInt(shipmentSnapshot.taxAmount),
                            currency: snapshot.currency,
                            statusHistory: {
                                create: { shipmentStatus: client_1.ShipmentStatus.PENDING },
                            },
                        },
                        select: { id: true, vendorId: true },
                    });
                    shipments.set(shipment.vendorId, shipment.id);
                }
                for (const line of snapshot.lines) {
                    const shipmentId = shipments.get(line.vendorId);
                    if (!shipmentId) {
                        throw this.conflict("The quote has an invalid vendor shipment group.");
                    }
                    await transaction.orderItem.create({
                        data: {
                            orderId: order.id,
                            shipmentId,
                            vendorId: line.vendorId,
                            productVariantId: line.variantId,
                            productTitle: line.title,
                            variantSku: line.sku,
                            quantity: line.quantity,
                            unitPrice: BigInt(line.unitPrice),
                            taxAmount: BigInt(line.taxAmount),
                            currency: snapshot.currency,
                        },
                    });
                    await transaction.stockReservation.create({
                        data: {
                            orderId: order.id,
                            productVariantId: line.variantId,
                            quantity: line.quantity,
                            expiresAt: reservationExpiresAt,
                        },
                    });
                }
                const result = {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    trackingToken,
                    status: order.status,
                    currency: snapshot.currency,
                    totals: {
                        subtotal: snapshot.subtotal,
                        shipping: snapshot.shippingTotal,
                        tax: snapshot.taxTotal,
                        total: snapshot.total,
                    },
                    reservationExpiresAt: reservationExpiresAt.toISOString(),
                };
                await transaction.idempotencyKey.create({
                    data: {
                        key: idempotencyKey,
                        endpoint,
                        requestHash,
                        response: result,
                        expiresAt: new Date(now.getTime() + idempotencyTtlMilliseconds),
                    },
                });
                return { response: result, replayed: false };
            }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
            return {
                data: transactionResult.response,
                replayed: transactionResult.replayed,
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            if (isPrismaError(error, "P2034")) {
                throw this.conflict("Inventory changed during order creation. Retry with the same Idempotency-Key.");
            }
            if (isPrismaError(error, "P2002")) {
                const replay = await this.findIdempotencyRecord(idempotencyKey, new Date());
                if (replay) {
                    const replayed = this.replayOrReject(replay, requestHash);
                    return { data: replayed, replayed: true };
                }
            }
            throw this.unavailable("The order could not be created.");
        }
    }
    async trackGuestOrder(orderNumber, trackingToken) {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: {
                id: true,
                trackingTokenHash: true,
                status: true,
                currency: true,
                subtotal: true,
                shippingTotal: true,
                taxTotal: true,
                total: true,
                createdAt: true,
                items: {
                    select: {
                        productTitle: true,
                        quantity: true,
                        unitPrice: true,
                        taxAmount: true,
                    },
                },
                shipments: {
                    select: {
                        status: true,
                        carrier: true,
                        trackingNumber: true,
                        shippingAmount: true,
                        taxAmount: true,
                        createdAt: true,
                    },
                },
                statusHistory: {
                    orderBy: { createdAt: "asc" },
                    select: { orderStatus: true, createdAt: true, reason: true },
                },
            },
        });
        if (!order?.trackingTokenHash || !matchesTrackingToken(order.trackingTokenHash, trackingToken)) {
            throw this.notFound("Order not found.");
        }
        return {
            orderNumber,
            status: order.status,
            currency: order.currency.trim(),
            totals: {
                subtotal: order.subtotal.toString(),
                shipping: order.shippingTotal.toString(),
                tax: order.taxTotal.toString(),
                total: order.total.toString(),
            },
            createdAt: order.createdAt.toISOString(),
            items: order.items.map((item) => ({
                title: item.productTitle,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toString(),
                taxAmount: item.taxAmount.toString(),
            })),
            shipments: order.shipments.map((shipment) => ({
                status: shipment.status,
                carrier: shipment.carrier,
                trackingNumber: shipment.trackingNumber,
                shippingAmount: shipment.shippingAmount.toString(),
                taxAmount: shipment.taxAmount.toString(),
                createdAt: shipment.createdAt.toISOString(),
            })),
            statusHistory: order.statusHistory.map((entry) => ({
                status: entry.orderStatus,
                createdAt: entry.createdAt.toISOString(),
                reason: entry.reason,
            })),
        };
    }
    async findIdempotencyRecord(key, now) {
        const record = await this.prisma.idempotencyKey.findUnique({
            where: { endpoint_key: { endpoint, key } },
        });
        if (record && record.expiresAt <= now) {
            await this.prisma.idempotencyKey.delete({ where: { id: record.id } });
            return null;
        }
        return record;
    }
    replayOrReject(record, requestHash) {
        if (record.requestHash !== requestHash) {
            throw new common_1.ConflictException({
                error: {
                    code: "IDEMPOTENCY_REPLAY",
                    message: "This Idempotency-Key was already used for a different request.",
                },
            });
        }
        return record.response;
    }
    assertAddressMatches(snapshot, input) {
        if (!snapshot.destination.city || !snapshot.destination.province) {
            throw this.conflict("The quote has an invalid delivery destination.");
        }
        void input;
    }
    assertCartMatches(snapshot, cart) {
        if (snapshot.lines.length !== cart.items.length) {
            throw this.conflict("The cart changed. Create a new checkout quote.");
        }
        for (const line of snapshot.lines) {
            const cartItem = cart.items.find((item) => item.productVariantId === line.variantId);
            const variant = cartItem?.productVariant;
            if (!cartItem ||
                !variant ||
                cartItem.quantity !== line.quantity ||
                cartItem.unitPrice.toString() !== line.unitPrice ||
                cartItem.currency.trim() !== line.currency ||
                variant.price.toString() !== line.unitPrice ||
                variant.vendorId !== line.vendorId ||
                variant.sku !== line.sku ||
                !isSellable(variant)) {
                throw this.conflict("The cart changed. Refresh it and create a new quote.");
            }
        }
    }
    async assertCurrentStock(transaction, cart, snapshot, now) {
        const reservations = await transaction.stockReservation.groupBy({
            by: ["productVariantId"],
            where: {
                productVariantId: { in: snapshot.lines.map((line) => line.variantId) },
                status: "ACTIVE",
                expiresAt: { gt: now },
            },
            _sum: { quantity: true },
        });
        const reserved = new Map(reservations.map((row) => [row.productVariantId, row._sum.quantity ?? 0]));
        for (const line of snapshot.lines) {
            const variant = cart.items.find((item) => item.productVariantId === line.variantId)?.productVariant;
            if (!variant ||
                line.quantity >
                    (0, inventory_1.calculateAvailableStock)(variant.stock, reserved.get(line.variantId) ?? 0)) {
                throw this.conflict("Stock changed. Create a new checkout quote.");
            }
        }
    }
    async allocateOrderNumber(transaction, now) {
        const parts = new Intl.DateTimeFormat("en", {
            timeZone: "Asia/Karachi",
            year: "2-digit",
            month: "2-digit",
        }).formatToParts(now);
        const year = parts.find((part) => part.type === "year")?.value;
        const month = parts.find((part) => part.type === "month")?.value;
        if (!year || !month)
            throw this.unavailable("Could not allocate an order number.");
        const period = `${year}${month}`;
        const counter = await transaction.orderNumberCounter.upsert({
            where: { period },
            create: { period, nextValue: 2n },
            update: { nextValue: { increment: 1n } },
            select: { nextValue: true },
        });
        const sequence = counter.nextValue - 1n;
        if (sequence > maximumOrderSequence) {
            throw this.unavailable("The monthly order number sequence is exhausted.");
        }
        return `ATV-${period}-${sequence.toString(36).toUpperCase().padStart(6, "0")}`;
    }
    conflict(message) {
        return new common_1.ConflictException({ error: { code: "CONFLICT", message } });
    }
    notFound(message) {
        return new common_1.NotFoundException({ error: { code: "NOT_FOUND", message } });
    }
    unavailable(message) {
        return new common_1.ServiceUnavailableException({
            error: { code: "DEPENDENCY_UNAVAILABLE", message },
        });
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
function parseQuoteSnapshot(value) {
    if (!isJsonRecord(value))
        throw new Error("Invalid stored quote snapshot.");
    const snapshot = value;
    if (typeof snapshot.cartId !== "string" ||
        snapshot.currency !== "PKR" ||
        !Array.isArray(snapshot.lines) ||
        !Array.isArray(snapshot.shipments) ||
        !snapshot.destination ||
        typeof snapshot.total !== "string") {
        throw new Error("Invalid stored quote snapshot.");
    }
    return snapshot;
}
function isJsonRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSellable(variant) {
    const product = variant.product;
    return (variant.status === "ACTIVE" &&
        variant.deletedAt === null &&
        product.status === "ACTIVE" &&
        ["APPROVED", "AUTO_APPROVED"].includes(product.approvalStatus) &&
        product.deletedAt === null &&
        product.vendor.status === "APPROVED" &&
        product.vendor.deletedAt === null &&
        product.category.isActive &&
        product.brand?.isActive === true &&
        product.images.length > 0);
}
function hashRequest(value) {
    return (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
}
function matchesTrackingToken(storedHash, token) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
        return false;
    const submittedHash = Buffer.from(hashRequest(token), "hex");
    const expectedHash = Buffer.from(storedHash, "hex");
    return (submittedHash.length === expectedHash.length &&
        (0, node_crypto_1.timingSafeEqual)(submittedHash, expectedHash));
}
function isPrismaError(error, code) {
    return (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        error.code === code);
}
//# sourceMappingURL=orders.service.js.map