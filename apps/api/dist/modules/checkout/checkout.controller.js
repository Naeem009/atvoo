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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cart_query_1 = require("../cart/cart-query");
const checkout_query_1 = require("./checkout-query");
const checkout_service_1 = require("./checkout.service");
let CheckoutController = class CheckoutController {
    checkoutService;
    constructor(checkoutService) {
        this.checkoutService = checkoutService;
    }
    async createQuote(header, body) {
        const sessionId = (0, cart_query_1.parseCartSession)(header);
        if (!sessionId) {
            throw new common_1.HttpException({ error: { code: "VALIDATION_FAILED", message: "X-Cart-Session is required." } }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const destination = (0, checkout_query_1.parseCheckoutDestination)(body);
        return {
            data: await this.checkoutService.createQuote(sessionId, destination),
        };
    }
};
exports.CheckoutController = CheckoutController;
__decorate([
    (0, common_1.Post)("quote"),
    (0, swagger_1.ApiOperation)({ summary: "Create an expiring server-calculated checkout quote" }),
    (0, swagger_1.ApiHeader)({ name: "X-Cart-Session", required: true }),
    __param(0, (0, common_1.Headers)("x-cart-session")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CheckoutController.prototype, "createQuote", null);
exports.CheckoutController = CheckoutController = __decorate([
    (0, swagger_1.ApiTags)("Checkout"),
    (0, common_1.Controller)("checkout"),
    __metadata("design:paramtypes", [checkout_service_1.CheckoutService])
], CheckoutController);
//# sourceMappingURL=checkout.controller.js.map