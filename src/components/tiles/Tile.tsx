"use client"

import {
  tileAriaLabel,
  tileToUnicode,
  type TileCode,
} from "@/lib/mahjong/tiles"
import clsx from "clsx"

export type TileProps = {
  code: TileCode
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  ariaLabel?: string
}

const sizeMap: Record<NonNullable<TileProps["size"]>, string> = {
  xs: "text-base",
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
}

export function Tile({ code, size = "sm", className, ariaLabel }: TileProps) {
  const isRed = typeof code === "string" && code.endsWith("5r")
  return (
    <span
      role="img"
      aria-label={ariaLabel || tileAriaLabel(code)}
      className={clsx(
        "inline-block align-middle leading-none",
        sizeMap[size],
        isRed && "text-red-500",
        className
      )}
    >
      {tileToUnicode(code)}
    </span>
  )
}

export default Tile
