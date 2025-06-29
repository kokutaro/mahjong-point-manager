import { renderHook, act } from "@testing-library/react"
import { usePerformanceMonitor } from "../usePerformanceMonitor"

describe("usePerformanceMonitor", () => {
  it("records render metrics", () => {
    const { result, unmount } = renderHook(() =>
      usePerformanceMonitor("Comp", true)
    )

    act(() => {
      unmount()
    })

    const metrics = result.current.getMetrics()
    expect(metrics.length).toBe(1)
    expect(metrics[0].componentName).toBe("Comp")
    expect(metrics[0].renderTime).toBeGreaterThanOrEqual(0)
  })
})
