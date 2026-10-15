import { Module } from "@nestjs/common";
import { PrismaModule } from "./database/prisma.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CartModule } from "./cart/cart.module";
import { CheckoutModule } from "./checkout/checkout.module";

@Module({
  imports: [PrismaModule, CatalogModule, CartModule, CheckoutModule],
})
export class ApiModule {}
