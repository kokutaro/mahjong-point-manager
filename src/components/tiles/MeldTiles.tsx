"use client"

import type { Meld } from "@/lib/mahjong/hand-notation"
import Tile from "@/components/tiles/Tile"
import type { TileGroupProps } from "@/components/tiles/TileGroup"
import clsx from "clsx"

type Props = {
  meld: Meld
  size?: TileGroupProps["size"]
  className?: string
}

export function MeldTiles({ meld, size = "sm", className }: Props) {
  if (meld.kind === "chi") {
    // called tile is shown at left and rotated
    const called = meld.called
    const others = meld.tiles.filter((t) => t !== called)
    const ordered = called ? [called, ...others] : [...meld.tiles]
    return (
      <span className={clsx("inline-flex gap-1 items-center", className)}>
        {ordered.map((t, i) => (
          <Tile key={`${t}-${i}`} code={t} size={size} rotate={i === 0} />
        ))}
      </span>
    )
  }

  if (meld.kind === "pon") {
    const idxRotate = meld.from === "shimo" ? 0 : meld.from === "toimen" ? 1 : 2
    return (
      <span className={clsx("inline-flex gap-1 items-center", className)}>
        {meld.tiles.map((t, i) => (
          <Tile
            key={`${t}-${i}`}
            code={t}
            size={size}
            rotate={i === idxRotate}
          />
        ))}
      </span>
    )
  }

  // kan
  if (meld.subtype === "closed") {
    // 両端を裏、間2つは表
    return (
      <span className={clsx("inline-flex gap-1 items-center", className)}>
        <Tile code={meld.tiles[0]} size={size} back />
        <Tile code={meld.tiles[1]} size={size} />
        <Tile code={meld.tiles[2]} size={size} />
        <Tile code={meld.tiles[3]} size={size} back />
      </span>
    )
  }

  if (meld.subtype === "open") {
    // 下家:左、対面:左から2番目、上家:右
    const idxRotate = meld.from === "shimo" ? 0 : meld.from === "toimen" ? 1 : 3
    return (
      <span className={clsx("inline-flex gap-1 items-center", className)}>
        {meld.tiles.map((t, i) => (
          <Tile
            key={`${t}-${i}`}
            code={t}
            size={size}
            rotate={i === idxRotate}
          />
        ))}
      </span>
    )
  }

  // added (加槓): ポンの向き + さらに同位置に横向きを重ねる
  const idxRotate = meld.from === "shimo" ? 0 : meld.from === "toimen" ? 1 : 2
  return (
    <span className={clsx("inline-flex gap-1 items-center", className)}>
      {meld.tiles.slice(0, 3).map((t, i) => (
        <span key={`${t}-${i}`} className="relative inline-block">
          <Tile code={t} size={size} rotate={i === idxRotate} />
          {i === idxRotate && (
            <span className="absolute -top-2 left-0">
              <Tile code={meld.tiles[3]} size={size} rotate />
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

export default MeldTiles
