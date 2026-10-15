import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { parseCartSession } from "../cart/cart-query";
import { parseCheckoutDestination } from "./checkout-query";
import { CheckoutService } from "./checkout.service";

@ApiTags("Checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("quote")
  @ApiOperation({ summary: "Create an expiring server-calculated checkout quote" })
  @ApiHeader({ name: "X-Cart-Session", required: true })
  async createQuote(
    @Headers("x-cart-session") header: string | undefined,
    @Body() body: unknown,
  ) {
    const sessionId = parseCartSession(header);
    if (!sessionId) {
      throw new HttpException(
        { error: { code: "VALIDATION_FAILED", message: "X-Cart-Session is required." } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const destination = parseCheckoutDestination(body);
    return {
      data: await this.checkoutService.createQuote(sessionId, destination),
    };
  }

}