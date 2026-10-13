"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ApiExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let ApiExceptionFilter = ApiExceptionFilter_1 = class ApiExceptionFilter {
    logger = new common_1.Logger(ApiExceptionFilter_1.name);
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        if (status >= common_1.HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(exception instanceof Error ? exception.stack : String(exception));
        }
        response.status(status).json(this.errorBody(exception, response));
    }
    errorBody(exception, response) {
        const requestId = response.locals.requestId;
        if (!(exception instanceof common_1.HttpException)) {
            return {
                error: {
                    code: "INTERNAL",
                    message: "An unexpected error occurred.",
                    ...(requestId && { requestId }),
                },
            };
        }
        const body = exception.getResponse();
        if (typeof body === "object" && body !== null) {
            const record = body;
            const nested = typeof record.error === "object" && record.error !== null
                ? record.error
                : record;
            const messages = Array.isArray(record.message) ? record.message : undefined;
            return {
                error: {
                    code: typeof nested.code === "string"
                        ? nested.code
                        : this.defaultCode(exception.getStatus()),
                    message: typeof nested.message === "string"
                        ? nested.message
                        : messages
                            ? "The request is invalid."
                            : "The request could not be completed.",
                    ...(nested.details !== undefined
                        ? { details: nested.details }
                        : messages && { details: messages }),
                    ...(requestId && { requestId }),
                },
            };
        }
        return {
            error: {
                code: this.defaultCode(exception.getStatus()),
                message: typeof body === "string" ? body : "The request could not be completed.",
                ...(requestId && { requestId }),
            },
        };
    }
    defaultCode(status) {
        if (status === common_1.HttpStatus.NOT_FOUND)
            return "NOT_FOUND";
        if (status === common_1.HttpStatus.UNPROCESSABLE_ENTITY)
            return "VALIDATION_FAILED";
        if (status === common_1.HttpStatus.SERVICE_UNAVAILABLE) {
            return "DEPENDENCY_UNAVAILABLE";
        }
        if (status >= common_1.HttpStatus.INTERNAL_SERVER_ERROR)
            return "INTERNAL";
        return "REQUEST_FAILED";
    }
};
exports.ApiExceptionFilter = ApiExceptionFilter;
exports.ApiExceptionFilter = ApiExceptionFilter = ApiExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], ApiExceptionFilter);
//# sourceMappingURL=api-exception.filter.js.map