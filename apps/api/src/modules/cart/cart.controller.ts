import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import {
  parseAddCartItem,
  parseCartItemId,
  parseCartItemQuantity,
  parseCartSession,
} from "./cart-query";
import { CartService } from "./cart.service";

@ApiTags("Cart")
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get or create a guest cart" })
  @ApiHeader({ name: "X-Cart-Session", required: false })
  async getCart(
    @Headers("x-cart-session") header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cart = await this.cartService.getCart(parseCartSession(header));
    response.setHeader("X-Cart-Session", cart.sessionId);
    return { data: cart.data };
  }

  @Post("items")
  @ApiOperation({ summary: "Add a product variant to the guest cart" })
  @ApiHeader({ name: "X-Cart-Session", required: false })
  async addItem(
    @Headers("x-cart-session") header: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parseAddCartItem(body);
    const cart = await this.cartService.addItem(
      parseCartSession(header),
      input.variantId,
      input.quantity,
    );
    response.setHeader("X-Cart-Session", cart.sessionId);
    return { data: cart.data };
  }

  @Patch("items/:itemId")
  @ApiOperation({ summary: "Set a guest cart line quantity" })
  @ApiHeader({ name: "X-Cart-Session", required: false })
  async updateItem(
    @Headers("x-cart-session") header: string | undefined,
    @Param("itemId") rawItemId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cart = await this.cartService.updateItem(
      parseCartSession(header),
      parseCartItemId(rawItemId),
      parseCartItemQuantity(body),
    );
    response.setHeader("X-Cart-Session", cart.sessionId);
    return { data: cart.data };
  }

  @Delete("items/:itemId")
  @ApiOperation({ summary: "Remove a guest cart line" })
  @ApiHeader({ name: "X-Cart-Session", required: false })
  async removeItem(
    @Headers("x-cart-session") header: string | undefined,
    @Param("itemId") rawItemId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cart = await this.cartService.removeItem(
      parseCartSession(header),
      parseCartItemId(rawItemId),
    );
    response.setHeader("X-Cart-Session", cart.sessionId);
    return { data: cart.data };
  }
}
