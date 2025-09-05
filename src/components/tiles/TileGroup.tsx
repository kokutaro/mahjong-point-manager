"use client"

import type { TileCode } from "@/lib/mahjong/tiles"
import { Tile } from "./Tile"
import clsx from "clsx"

export type TileGroupProps = {
  codes: TileCode[]
  size?: "xs" | "sm" | "md" | "lg"
  gap?: "none" | "sm" | "md"
  wrap?: boolean
  className?: string
}

const gapMap = {
  none: "gap-0",
  sm: "gap-1",
  md: "gap-2",
}

export function TileGroup({
  codes,
  size = "sm",
  gap = "sm",
  wrap = false,
  className,
}: TileGroupProps) {
  return (
    <span
      className={clsx(
        "inline-flex",
        gapMap[gap],
        wrap && "flex-wrap",
        className
      )}
    >
      {codes.map((c, i) => (
        <Tile key={`${c}-${i}`} code={c} size={size} />
      ))}
    </span>
  )
}

export default TileGroup
