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
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const catalog_service_1 = require("./catalog.service");
const catalog_query_1 = require("./catalog-query");
let CatalogController = class CatalogController {
    catalogService;
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
    async searchProducts(query, ifNoneMatch, response) {
        const parsed = (0, catalog_query_1.parseCatalogQuery)(query);
        if (!parsed.q) {
            throw new common_1.HttpException({
                error: {
                    code: "VALIDATION_FAILED",
                    message: "The q parameter is required.",
                    details: [{ field: "q", issue: "Required for product search." }],
                },
            }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const result = await this.catalogService.listProducts(parsed);
        return this.setCacheHeaders(result, ifNoneMatch, response);
    }
    async listProducts(query, ifNoneMatch, response) {
        const result = await this.catalogService.listProducts((0, catalog_query_1.parseCatalogQuery)(query));
        return this.setCacheHeaders(result, ifNoneMatch, response);
    }
    async getProduct(idOrSlug, ifNoneMatch, response) {
        const result = await this.catalogService.getProduct(idOrSlug);
        return this.setCacheHeaders(result, ifNoneMatch, response);
    }
    async listCategories(ifNoneMatch, response) {
        const result = await this.catalogService.listCategories();
        return this.setCacheHeaders(result, ifNoneMatch, response);
    }
    async listBrands(ifNoneMatch, response) {
        const result = await this.catalogService.listBrands();
        return this.setCacheHeaders(result, ifNoneMatch, response);
    }
    setCacheHeaders(data, ifNoneMatch, response) {
        const etag = this.catalogService.createEtag(data);
        response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
        response.setHeader("ETag", etag);
        if (ifNoneMatch?.trim() === "*" ||
            ifNoneMatch?.split(",").some((value) => value.trim() === etag)) {
            response.status(common_1.HttpStatus.NOT_MODIFIED);
            return undefined;
        }
        return data;
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)("products/search"),
    (0, swagger_1.ApiOperation)({ summary: "Search the public product catalog" }),
    (0, swagger_1.ApiQuery)({ name: "q", required: true, minLength: 2, maxLength: 100 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Matching public products." }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("if-none-match")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "searchProducts", null);
__decorate([
    (0, common_1.Get)("products"),
    (0, swagger_1.ApiOperation)({ summary: "List public catalog products" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Paginated public products." }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("if-none-match")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "listProducts", null);
__decorate([
    (0, common_1.Get)("products/:idOrSlug"),
    (0, swagger_1.ApiOperation)({ summary: "Get one public product by UUID or slug" }),
    (0, swagger_1.ApiParam)({ name: "idOrSlug", description: "UUID or product slug (up to 180 characters)" }),
    __param(0, (0, common_1.Param)("idOrSlug")),
    __param(1, (0, common_1.Headers)("if-none-match")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Get)("categories"),
    (0, swagger_1.ApiOperation)({ summary: "List active catalog categories" }),
    __param(0, (0, common_1.Headers)("if-none-match")),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Get)("brands"),
    (0, swagger_1.ApiOperation)({ summary: "List active catalog brands" }),
    __param(0, (0, common_1.Headers)("if-none-match")),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "listBrands", null);
exports.CatalogController = CatalogController = __decorate([
    (0, swagger_1.ApiTags)("Catalog"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map