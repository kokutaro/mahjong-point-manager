import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { calculateScore, validateHanFu } from "@/lib/score"

const calculateScoreSchema = z.object({
  han: z.number().int().min(1).max(13),
  fu: z.number().int().min(20).max(110),
  isOya: z.boolean(),
  isTsumo: z.boolean(),
  honba: z.number().int().min(0).default(0),
  kyotaku: z.number().int().min(0).default(0),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = calculateScoreSchema.parse(body)

    // 翻数・符数の組み合わせ検証
    if (!validateHanFu(validatedData.han, validatedData.fu)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "無効な翻数・符数の組み合わせです",
            details: `${validatedData.han}翻${validatedData.fu}符は無効です`,
          },
        },
        { status: 400 }
      )
    }

    const result = await calculateScore(validatedData)

    return NextResponse.json({
      success: true,
      data: {
        input: validatedData,
        result,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "バリデーションエラー",
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    console.error("Score calculation failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "点数計算に失敗しました",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
