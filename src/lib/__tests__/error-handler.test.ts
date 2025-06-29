import {
  AppError,
  ValidationError,
  createErrorResponse,
  createSuccessResponse,
  validateSchema,
  withErrorHandler,
  isAppError,
  isValidationError,
  getErrorDetails,
} from "../error-handler"
import { z } from "zod"

describe("error-handler", () => {
  test("createErrorResponse handles AppError", async () => {
    const err = new AppError("TEST", "failed", undefined, 418)
    const res = createErrorResponse(err)
    expect(res.status).toBe(418)
    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("TEST")
  })

  test("createErrorResponse handles ZodError", async () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({})
    const err = (result as any).error as z.ZodError
    const res = createErrorResponse(err)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  test("createErrorResponse handles generic Error", async () => {
    const res = createErrorResponse(new Error("oops"), "default")
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error.message).toBe("default")
  })

  test("createSuccessResponse returns success", async () => {
    const res = createSuccessResponse({ ok: true })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true, data: { ok: true } })
  })

  test("validateSchema parses valid data", () => {
    const schema = z.object({ id: z.number() })
    expect(validateSchema(schema, { id: 1 })).toEqual({ id: 1 })
    expect(() => validateSchema(schema, {})).toThrow(ValidationError)
  })

  test("withErrorHandler wraps async functions", async () => {
    const fn = withErrorHandler(async () => createSuccessResponse("ok"), "fail")
    const okRes = await fn()
    expect((await okRes.json()).success).toBe(true)

    const errFn = withErrorHandler(async () => {
      throw new Error("boom")
    }, "fail")
    const errRes = await errFn()
    expect(errRes.status).toBe(500)
    const data = await errRes.json()
    expect(data.error.message).toBe("fail")
  })

  test("type guards and detail extractor", () => {
    const appErr = new AppError("X", "x")
    expect(isAppError(appErr)).toBe(true)
    expect(isAppError(new Error("x"))).toBe(false)

    const zErr = new z.ZodError([])
    expect(isValidationError(zErr)).toBe(true)
    expect(isValidationError(appErr)).toBe(false)

    expect(getErrorDetails(appErr).type).toBe("AppError")
    expect(getErrorDetails(zErr).type).toBe("ZodError")
    expect(getErrorDetails(new Error("boom")).type).toBe("Error")
    expect(getErrorDetails("oops").type).toBe("Unknown")
  })
})
