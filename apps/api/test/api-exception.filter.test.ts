import assert from "node:assert/strict";
import test from "node:test";
import { ArgumentsHost, HttpException } from "@nestjs/common";
import type { Response } from "express";
import { ApiExceptionFilter } from "../src/common/api-exception.filter";

function captureFilterResponse(exception: unknown) {
  const captured: { status?: number; body?: unknown } = {};
  const response = {
    locals: { requestId: "request-123" },
    status(status: number) {
      captured.status = status;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return captured;
}

test("API exception responses keep structured details and request IDs together", () => {
  const result = captureFilterResponse(
    new HttpException(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "The catalog query is invalid.",
          details: [{ field: "page", issue: "must be positive" }],
        },
      },
      422,
    ),
  );

  assert.deepEqual(result, {
    status: 422,
    body: {
      error: {
        code: "VALIDATION_FAILED",
        message: "The catalog query is invalid.",
        details: [{ field: "page", issue: "must be positive" }],
        requestId: "request-123",
      },
    },
  });
});

test("unexpected API exceptions do not expose internal error text", () => {
  const result = captureFilterResponse(new Error("sensitive internal detail"));

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    error: {
      code: "INTERNAL",
      message: "An unexpected error occurred.",
      requestId: "request-123",
    },
  });
});
