"use client"

import { lazy, Suspense } from "react"
import LoadingSpinner from "./LoadingSpinner"

// Lazy load heavy components to improve initial bundle size
export const LazyGameResult = lazy(() => import("./GameResult"))
export const LazyQRCodeModal = lazy(() => import("./QRCodeModal"))
export const LazyPointAnimation = lazy(() => import("./PointAnimation"))
export const LazyScoreInputForm = lazy(() => import("./ScoreInputForm"))

// HOC for wrapping lazy components with Suspense
export function withSuspense<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: React.ReactNode
) {
  return function SuspenseWrapper(props: T) {
    return (
      <Suspense fallback={fallback || <LoadingSpinner />}>
        <Component {...props} />
      </Suspense>
    )
  }
}

// Pre-wrapped components ready to use
export const GameResultWithSuspense = withSuspense(LazyGameResult)
export const QRCodeModalWithSuspense = withSuspense(LazyQRCodeModal)
export const PointAnimationWithSuspense = withSuspense(LazyPointAnimation)
export const ScoreInputFormWithSuspense = withSuspense(LazyScoreInputForm)
