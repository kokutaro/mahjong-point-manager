import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createPlayerSchema = z.object({
  name: z.string().min(1).max(30),
  avatar: z.string().url().optional(),
})

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: players,
    })
  } catch (error) {
    console.error("Failed to fetch players:", error)
    return NextResponse.json(
      {
        success: false,
        error: { message: "プレイヤー取得に失敗しました" },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createPlayerSchema.parse(body)

    const player = await prisma.player.create({
      data: validatedData,
    })

    return NextResponse.json(
      {
        success: true,
        data: player,
      },
      { status: 201 }
    )
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

    console.error("Failed to create player:", error)
    return NextResponse.json(
      {
        success: false,
        error: { message: "プレイヤー作成に失敗しました" },
      },
      { status: 500 }
    )
  }
}
