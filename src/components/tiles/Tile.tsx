"use client"

import {
  tileAriaLabel,
  tileToImageSrc,
  type TileCode,
} from "@/lib/mahjong/tiles"
import clsx from "clsx"
import Image from "next/image"

export type TileProps = {
  code: TileCode
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  ariaLabel?: string
  rotate?: boolean
  back?: boolean
}

// 画像サイズ（px）: 高さ=幅（等角比で内側に収まる）
const sizePx: Record<NonNullable<TileProps["size"]>, number> = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 40,
}

export function Tile({
  code,
  size = "sm",
  className,
  ariaLabel,
  rotate = false,
  back = false,
}: TileProps) {
  const isRed = typeof code === "string" && code.endsWith("5r")
  const dim = sizePx[size]
  const alt = back ? "裏" : ariaLabel || tileAriaLabel(code)
  const src = back ? "/img/pai/blank.gif" : tileToImageSrc(code)
  return (
    <span
      role="img"
      aria-label={alt}
      className={clsx(
        "relative inline-flex items-end justify-center leading-none shrink-0",
        className
      )}
      style={{ width: dim / 1.2, height: dim }}
    >
      {rotate ? (
        <span
          className={
            "absolute bottom-5 left-0 w-full h-full origin-bottom-left rotate-90"
          }
        >
          <Image
            src={src}
            alt={alt}
            width={dim / 1.2}
            height={dim}
            className={"object-contain w-full h-full"}
            priority={false}
          />
        </span>
      ) : (
        <span className={"absolute inset-0 w-full h-full"}>
          <Image
            src={src}
            alt={alt}
            width={dim / 1.2}
            height={dim}
            className={"object-contain w-full h-full"}
            priority={false}
          />
        </span>
      )}
      {!back && isRed && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white"
        />
      )}
    </span>
  )
}

export default Tile
