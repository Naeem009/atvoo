"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCheckoutQuoteId = parseCheckoutQuoteId;
exports.parseIdempotencyKey = parseIdempotencyKey;
exports.parseCreateOrderInput = parseCreateOrderInput;
exports.parseCheckoutDestination = parseCheckoutDestination;
const common_1 = require("@nestjs/common");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseCheckoutQuoteId(value) {
    if (typeof value === "string" && uuidPattern.test(value))
        return value;
    throw validationError("The checkout quote ID must be a UUID.");
}
function parseIdempotencyKey(value) {
    if (typeof value === "string" && uuidPattern.test(value))
        return value;
    throw validationError("Idempotency-Key must be a UUID.");
}
function parseCreateOrderInput(value) {
    const allowedKeys = [
        "quoteId",
        "buyerEmail",
        "buyerPhone",
        "recipientName",
        "addressLine1",
        "addressLine2",
        "postalCode",
    ];
    if (!isRecord(value) ||
        Object.keys(value).some((key) => !allowedKeys.includes(key)) ||
        typeof value.quoteId !== "string" ||
        !uuidPattern.test(value.quoteId) ||
        typeof value.buyerEmail !== "string" ||
        value.buyerEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.buyerEmail.trim()) ||
        typeof value.buyerPhone !== "string" ||
        !/^\+?[0-9][0-9\s()-]{7,24}$/.test(value.buyerPhone.trim()) ||
        typeof value.recipientName !== "string" ||
        value.recipientName.trim().length < 2 ||
        value.recipientName.trim().length > 160 ||
        typeof value.addressLine1 !== "string" ||
        value.addressLine1.trim().length < 5 ||
        value.addressLine1.trim().length > 200 ||
        (value.addressLine2 !== undefined &&
            (typeof value.addressLine2 !== "string" ||
                value.addressLine2.trim().length > 200)) ||
        (value.postalCode !== undefined &&
            (typeof value.postalCode !== "string" || value.postalCode.length > 20))) {
        throw validationError("Provide valid order contact and delivery details.");
    }
    return {
        quoteId: value.quoteId,
        buyerEmail: value.buyerEmail.trim().toLowerCase(),
        buyerPhone: value.buyerPhone.trim(),
        recipientName: value.recipientName.trim(),
        addressLine1: value.addressLine1.trim(),
        ...(typeof value.addressLine2 === "string" && value.addressLine2.trim()
            ? { addressLine2: value.addressLine2.trim() }
            : {}),
        ...(typeof value.postalCode === "string" && value.postalCode.trim()
            ? { postalCode: value.postalCode.trim() }
            : {}),
    };
}
function parseCheckoutDestination(value) {
    if (!isRecord(value) ||
        Object.keys(value).some((key) => !["province", "city"].includes(key)) ||
        typeof value.province !== "string" ||
        typeof value.city !== "string") {
        throw validationError("Provide a province and city for delivery.");
    }
    const province = value.province.trim();
    const city = value.city.trim();
    if (province.length < 2 || province.length > 100 || city.length < 2 || city.length > 100) {
        throw validationError("Province and city must each contain 2 to 100 characters.");
    }
    return { province, city, countryCode: "PK" };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validationError(message) {
    return new common_1.HttpException({ error: { code: "VALIDATION_FAILED", message } }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
}
//# sourceMappingURL=checkout-query.js.map