import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { parseCartSession } from "../cart/cart-query";
import {
  parseCreateOrderInput,
  parseIdempotencyKey,
} from "./checkout-query";
import { OrdersService } from "./orders.service";

@ApiTags("Orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("create")
  @ApiOperation({ summary: "Create an idempotent order from a current quote" })
  @ApiHeader({ name: "X-Cart-Session", required: true })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async createOrder(
    @Headers("x-cart-session") rawSessionId: string | undefined,
    @Headers("idempotency-key") rawIdempotencyKey: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionId = parseCartSession(rawSessionId);
    if (!sessionId) {
      throw new HttpException(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "X-Cart-Session is required.",
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const result = await this.ordersService.createGuestOrder(
      sessionId,
      parseIdempotencyKey(rawIdempotencyKey),
      parseCreateOrderInput(body),
    );
    if (result.replayed) response.setHeader("Idempotent-Replayed", "true");
    return { data: result.data };
  }
}