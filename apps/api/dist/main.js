"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
require("reflect-metadata");
const repositoryRoot = (0, node_path_1.resolve)(__dirname, "../../..");
(0, dotenv_1.config)({
    path: [
        (0, node_path_1.resolve)(repositoryRoot, ".env.local"),
        (0, node_path_1.resolve)(repositoryRoot, ".env"),
    ],
});
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const api_exception_filter_1 = require("./common/api-exception.filter");
const api_module_1 = require("./modules/api.module");
async function bootstrap() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL must be configured.");
    }
    if (!process.env.SUPABASE_URL ||
        !process.env.SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA) {
        throw new Error("SUPABASE_URL and SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA must be configured.");
    }
    const supabaseUrl = new URL(process.env.SUPABASE_URL);
    if (!["http:", "https:"].includes(supabaseUrl.protocol)) {
        throw new Error("SUPABASE_URL must use HTTP or HTTPS.");
    }
    const app = await core_1.NestFactory.create(api_module_1.ApiModule);
    const origins = process.env.CORS_ORIGIN
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [];
    app.enableCors({
        origin: origins.length > 0 ? origins : false,
        credentials: true,
    });
    app.use((request, response, next) => {
        const suppliedId = request.header("x-request-id");
        const requestId = suppliedId && /^[A-Za-z0-9._-]{1,100}$/.test(suppliedId)
            ? suppliedId
            : (0, node_crypto_1.randomUUID)();
        response.locals.requestId = requestId;
        response.setHeader("x-request-id", requestId);
        next();
    });
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new api_exception_filter_1.ApiExceptionFilter());
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle("ATVOO Catalog API")
        .setDescription("Public product discovery endpoints.")
        .setVersion("1.0")
        .build();
    swagger_1.SwaggerModule.setup("api/docs", app, swagger_1.SwaggerModule.createDocument(app, swaggerConfig));
    app.enableShutdownHooks();
    await app.listen(Number(process.env.API_PORT ?? 3001), "0.0.0.0");
}
void bootstrap();
//# sourceMappingURL=main.js.map