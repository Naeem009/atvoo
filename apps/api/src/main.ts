import { config } from "dotenv";
import "reflect-metadata";

const repositoryRoot = resolve(__dirname, "../../..");
config({
  path: [
    resolve(repositoryRoot, ".env.local"),
    resolve(repositoryRoot, ".env"),
  ],
});

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { NextFunction, Request, Response } from "express";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { ApiModule } from "./modules/api.module";

async function bootstrap(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured.");
  }
  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA
  ) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA must be configured.",
    );
  }
  const supabaseUrl = new URL(process.env.SUPABASE_URL);
  if (!["http:", "https:"].includes(supabaseUrl.protocol)) {
    throw new Error("SUPABASE_URL must use HTTP or HTTPS.");
  }

  const app = await NestFactory.create(ApiModule);
  const origins =
    process.env.CORS_ORIGIN
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const suppliedId = request.header("x-request-id");
    const requestId =
      suppliedId && /^[A-Za-z0-9._-]{1,100}$/.test(suppliedId)
        ? suppliedId
        : randomUUID();
    response.locals.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ATVOO Catalog API")
    .setDescription("Public product discovery endpoints.")
    .setVersion("1.0")
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 3001), "0.0.0.0");
}

void bootstrap();
