'use client'

import React, { useEffect, useRef } from 'react'

interface PerformanceMetrics {
  componentName: string
  renderTime: number
  timestamp: number
}

export function usePerformanceMonitor(componentName: string, enabled = false) {
  const startTimeRef = useRef<number>()
  const metricsRef = useRef<PerformanceMetrics[]>([])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    startTimeRef.current = performance.now()

    return () => {
      if (startTimeRef.current) {
        const renderTime = performance.now() - startTimeRef.current
        const metric: PerformanceMetrics = {
          componentName,
          renderTime,
          timestamp: Date.now()
        }

        metricsRef.current.push(metric)

        // Keep only last 100 metrics to prevent memory leaks
        if (metricsRef.current.length > 100) {
          metricsRef.current = metricsRef.current.slice(-100)
        }

        // Log slow renders in development
        if (process.env.NODE_ENV === 'development' && renderTime > 16) {
          console.warn(
            `🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`
          )
        }
      }
    }
  }, [componentName, enabled])

  const getMetrics = () => metricsRef.current
  const getAverageRenderTime = () => {
    const metrics = metricsRef.current
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length
  }

  return {
    getMetrics,
    getAverageRenderTime
  }
}

// Higher-order component for performance monitoring
export function withPerformanceMonitor<T extends object>(
  Component: React.ComponentType<T>,
  componentName?: string,
  enabled = false
) {
  return function PerformanceMonitoredComponent(props: T) {
    const displayName = componentName || Component.displayName || Component.name || 'Component'
    usePerformanceMonitor(displayName, enabled)
    return React.createElement(Component, props)
  }
}