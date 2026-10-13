import { Module } from "@nestjs/common";
import { PrismaModule } from "./database/prisma.module";
import { CatalogModule } from "./catalog/catalog.module";

@Module({
  imports: [PrismaModule, CatalogModule],
})
export class ApiModule {}
