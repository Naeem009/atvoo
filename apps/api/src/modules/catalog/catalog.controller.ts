import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CatalogService } from "./catalog.service";
import { parseCatalogQuery } from "./catalog-query";

@ApiTags("Catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("products/search")
  @ApiOperation({ summary: "Search the public product catalog" })
  @ApiQuery({ name: "q", required: true, minLength: 2, maxLength: 100 })
  @ApiResponse({ status: 200, description: "Matching public products." })
  async searchProducts(
    @Query() query: Record<string, unknown>,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = parseCatalogQuery(query);
    if (!parsed.q) {
      throw new HttpException(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "The q parameter is required.",
            details: [{ field: "q", issue: "Required for product search." }],
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const result = await this.catalogService.listProducts(parsed);
    return this.setCacheHeaders(result, ifNoneMatch, response);
  }

  @Get("products")
  @ApiOperation({ summary: "List public catalog products" })
  @ApiResponse({ status: 200, description: "Paginated public products." })
  async listProducts(
    @Query() query: Record<string, unknown>,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.catalogService.listProducts(
      parseCatalogQuery(query),
    );
    return this.setCacheHeaders(result, ifNoneMatch, response);
  }

  @Get("products/:idOrSlug")
  @ApiOperation({ summary: "Get one public product by UUID or slug" })
  @ApiParam({ name: "idOrSlug", description: "UUID or product slug (up to 180 characters)" })
  async getProduct(
    @Param("idOrSlug") idOrSlug: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.catalogService.getProduct(idOrSlug);
    return this.setCacheHeaders(result, ifNoneMatch, response);
  }

  @Get("categories")
  @ApiOperation({ summary: "List active catalog categories" })
  async listCategories(
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.catalogService.listCategories();
    return this.setCacheHeaders(result, ifNoneMatch, response);
  }

  @Get("brands")
  @ApiOperation({ summary: "List active catalog brands" })
  async listBrands(
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.catalogService.listBrands();
    return this.setCacheHeaders(result, ifNoneMatch, response);
  }

  @Get("vendors")
  @ApiOperation({ summary: "List approved vendors with public products" })
  async listVendors(
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.catalogService.listVendors();
    return this.setCacheHeaders(result, ifNoneMatch, response);
  }

  private setCacheHeaders<T>(
    data: T,
    ifNoneMatch: string | undefined,
    response: Response,
  ): T | undefined {
    const etag = this.catalogService.createEtag(data);
    response.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    );
    response.setHeader("ETag", etag);
    if (
      ifNoneMatch?.trim() === "*" ||
      ifNoneMatch?.split(",").some((value) => value.trim() === etag)
    ) {
      response.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return data;
  }
}
