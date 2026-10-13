import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(this.errorBody(exception, response));
  }

  private errorBody(exception: unknown, response: Response): ApiErrorBody {
    const requestId = response.locals.requestId as string | undefined;
    if (!(exception instanceof HttpException)) {
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
      const record = body as Record<string, unknown>;
      const nested =
        typeof record.error === "object" && record.error !== null
          ? (record.error as Record<string, unknown>)
          : record;
      const messages = Array.isArray(record.message) ? record.message : undefined;
      return {
        error: {
          code:
            typeof nested.code === "string"
              ? nested.code
              : this.defaultCode(exception.getStatus()),
          message:
            typeof nested.message === "string"
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
        message:
          typeof body === "string" ? body : "The request could not be completed.",
        ...(requestId && { requestId }),
      },
    };
  }

  private defaultCode(status: number): string {
    if (status === HttpStatus.NOT_FOUND) return "NOT_FOUND";
    if (status === HttpStatus.UNPROCESSABLE_ENTITY) return "VALIDATION_FAILED";
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      return "DEPENDENCY_UNAVAILABLE";
    }
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return "INTERNAL";
    return "REQUEST_FAILED";
  }
}
