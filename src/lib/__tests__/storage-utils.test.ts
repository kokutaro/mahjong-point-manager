import {
  clearLocalStorageOnQuotaError,
  checkLocalStorageUsage,
  safeSetLocalStorage,
  safeGetLocalStorage,
} from "../storage-utils"

describe("storage-utils", () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  test("safeSetLocalStorage saves value", () => {
    const ok = safeSetLocalStorage("foo", "bar")
    expect(ok).toBe(true)
    expect(localStorage.getItem("foo")).toBe("bar")
  })

  test("safeSetLocalStorage handles quota error", () => {
    const original = localStorage.setItem.bind(localStorage)
    const spy = jest
      .spyOn(localStorage.__proto__, "setItem")
      .mockImplementationOnce(() => {
        const err = new Error("full") as Error & { name: string }
        err.name = "QuotaExceededError"
        throw err
      })
      .mockImplementationOnce(original)

    const ok = safeSetLocalStorage("foo", "bar")
    expect(ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem("foo")).toBe("bar")
  })

  test("safeGetLocalStorage returns null on error", () => {
    jest.spyOn(localStorage.__proto__, "getItem").mockImplementationOnce(() => {
      throw new Error("fail")
    })
    expect(safeGetLocalStorage("foo")).toBeNull()
  })

  test("clearLocalStorageOnQuotaError removes known keys", () => {
    localStorage.setItem("mahjong-app-store", "x")
    localStorage.setItem("game_state", "y")
    clearLocalStorageOnQuotaError()
    expect(localStorage.getItem("mahjong-app-store")).toBeNull()
    expect(localStorage.getItem("game_state")).toBeNull()
  })

  test("checkLocalStorageUsage sums lengths", () => {
    localStorage.setItem("a", "1234")
    localStorage.setItem("b", "56")
    const size = checkLocalStorageUsage()
    expect(size).toBe(6)
  })

  test("safeSetLocalStorage returns false on generic error", () => {
    jest.spyOn(localStorage.__proto__, "setItem").mockImplementationOnce(() => {
      throw new Error("bad")
    })
    const ok = safeSetLocalStorage("x", "y")
    expect(ok).toBe(false)
  })

  test("checkLocalStorageUsage handles error", () => {
    const proto = Object.getPrototypeOf(localStorage) as any
    jest.spyOn(proto, "hasOwnProperty").mockImplementation(() => {
      throw new Error("fail")
    })
    const size = checkLocalStorageUsage()
    expect(size).toBe(0)
  })

  test("clearLocalStorageOnQuotaError error path", () => {
    jest
      .spyOn(localStorage.__proto__, "removeItem")
      .mockImplementationOnce(() => {
        throw new Error("remove fail")
      })
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    clearLocalStorageOnQuotaError()
    expect(errSpy).toHaveBeenCalled()
  })
})
