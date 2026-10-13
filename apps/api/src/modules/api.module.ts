import { Module } from "@nestjs/common";
import { PrismaModule } from "./database/prisma.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CartModule } from "./cart/cart.module";

@Module({
  imports: [PrismaModule, CatalogModule, CartModule],
})
export class ApiModule {}
