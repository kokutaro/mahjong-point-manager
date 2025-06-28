import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ErrorCode, ApiError, ApiResponse } from '@/schemas/common'

// ===== エラー定義 =====

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details, 400)
    this.name = 'ValidationError'
  }
}

export class GameNotFoundError extends AppError {
  constructor(gameId?: string) {
    super(
      'GAME_NOT_FOUND',
      gameId ? `ゲーム ${gameId} が見つかりません` : 'ゲームが見つかりません',
      { gameId },
      404
    )
    this.name = 'GameNotFoundError'
  }
}

export class PlayerNotFoundError extends AppError {
  constructor(playerId?: string) {
    super(
      'PLAYER_NOT_FOUND',
      playerId ? `プレイヤー ${playerId} が見つかりません` : 'プレイヤーが見つかりません',
      { playerId },
      404
    )
    this.name = 'PlayerNotFoundError'
  }
}

export class GameStateError extends AppError {
  constructor(expectedState: string, currentState: string) {
    super(
      'GAME_NOT_PLAYING',
      `ゲーム状態が無効です。期待: ${expectedState}, 現在: ${currentState}`,
      { expectedState, currentState },
      400
    )
    this.name = 'GameStateError'
  }
}

export class InsufficientPointsError extends AppError {
  constructor(required: number, current: number) {
    super(
      'INSUFFICIENT_POINTS',
      `点数が不足しています。必要: ${required}点, 現在: ${current}点`,
      { required, current },
      400
    )
    this.name = 'InsufficientPointsError'
  }
}

export class InvalidHanFuError extends AppError {
  constructor(han: number, fu: number) {
    super(
      'INVALID_HAN_FU',
      `無効な翻符の組み合わせです。翻数: ${han}, 符数: ${fu}`,
      { han, fu },
      400
    )
    this.name = 'InvalidHanFuError'
  }
}

export class AlreadyReachError extends AppError {
  constructor(playerId: string) {
    super(
      'ALREADY_REACH',
      'このプレイヤーは既にリーチしています',
      { playerId },
      400
    )
    this.name = 'AlreadyReachError'
  }
}

export class ScorePatternNotFoundError extends AppError {
  constructor(han: number, fu: number) {
    super(
      'SCORE_PATTERN_NOT_FOUND',
      `指定された翻符の点数パターンが見つかりません。翻数: ${han}, 符数: ${fu}`,
      { han, fu },
      400
    )
    this.name = 'ScorePatternNotFoundError'
  }
}

// ===== エラーハンドリング関数 =====

/**
 * 統一されたAPIエラーレスポンスを生成
 */
export function createErrorResponse(
  error: AppError | Error | unknown,
  defaultMessage: string = 'サーバーエラーが発生しました'
): NextResponse {
  let apiError: ApiError
  let statusCode: number

  if (error instanceof AppError) {
    apiError = {
      code: error.code,
      message: error.message,
      details: error.details
    }
    statusCode = error.statusCode
  } else if (error instanceof z.ZodError) {
    apiError = {
      code: 'VALIDATION_ERROR',
      message: '入力データが無効です',
      details: error.errors
    }
    statusCode = 400
  } else if (error instanceof Error) {
    console.error('Unexpected error:', error)
    apiError = {
      code: 'INTERNAL_ERROR',
      message: defaultMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
    statusCode = 500
  } else {
    console.error('Unknown error:', error)
    apiError = {
      code: 'INTERNAL_ERROR',
      message: defaultMessage
    }
    statusCode = 500
  }

  const response: ApiResponse = {
    success: false,
    error: apiError
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse<T>(data: T): NextResponse {
  const response: ApiResponse = {
    success: true,
    data
  }
  return NextResponse.json(response)
}

/**
 * Zodバリデーションを実行し、エラー時は例外を投げる
 */
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError('バリデーションエラー', result.error.errors)
  }
  return result.data
}

/**
 * 非同期関数をラップしてエラーハンドリングを統一
 */
export function withErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<NextResponse>,
  defaultErrorMessage?: string
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args)
    } catch (error) {
      return createErrorResponse(error, defaultErrorMessage)
    }
  }
}

/**
 * ゲーム状態の妥当性をチェック
 */
export function validateGameState(
  game: { status: string } | null,
  expectedStatus: string | string[],
  gameId?: string
): asserts game is NonNullable<typeof game> {
  if (!game) {
    throw new GameNotFoundError(gameId)
  }

  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
  if (!expectedStatuses.includes(game.status)) {
    throw new GameStateError(expectedStatuses.join(' or '), game.status)
  }
}

/**
 * プレイヤーの存在をチェック
 */
export function validatePlayerExists<T>(
  player: T | null | undefined,
  playerId?: string
): asserts player is NonNullable<T> {
  if (!player) {
    throw new PlayerNotFoundError(playerId)
  }
}

/**
 * 権限チェック（ホストプレイヤー）
 */
export function validateHostPermission(
  game: { hostPlayerId: string },
  playerId: string
): void {
  if (game.hostPlayerId !== playerId) {
    throw new AppError(
      'INVALID_PLAYERS',
      'この操作を行う権限がありません',
      { requiredHost: game.hostPlayerId, providedPlayer: playerId },
      403
    )
  }
}

/**
 * 点数の妥当性をチェック
 */
export function validateSufficientPoints(
  currentPoints: number,
  requiredPoints: number,
  playerId?: string
): void {
  if (currentPoints < requiredPoints) {
    throw new InsufficientPointsError(requiredPoints, currentPoints)
  }
}

/**
 * リーチ状態をチェック
 */
export function validateNotAlreadyReach(
  isReach: boolean,
  playerId: string
): void {
  if (isReach) {
    throw new AlreadyReachError(playerId)
  }
}

/**
 * プレイヤー位置の妥当性をチェック
 */
export function validatePlayerPosition(position: number): void {
  if (position < 0 || position > 3) {
    throw new AppError(
      'INVALID_PLAYER_POSITION',
      `無効なプレイヤー位置です: ${position}`,
      { position },
      400
    )
  }
}

/**
 * 翻符の組み合わせをチェック
 */
export function validateHanFuCombination(han: number, fu: number): void {
  // 20符は2翻以上
  if (fu === 20 && han < 2) {
    throw new InvalidHanFuError(han, fu)
  }
  // 25符は2翻以上  
  if (fu === 25 && han < 2) {
    throw new InvalidHanFuError(han, fu)
  }
  // 一般的な符数範囲
  if (fu < 20 || fu > 110) {
    throw new InvalidHanFuError(han, fu)
  }
  // 符数は10の倍数（20符、25符除く）
  if (fu !== 20 && fu !== 25 && fu % 10 !== 0) {
    throw new InvalidHanFuError(han, fu)
  }
  // 翻数範囲
  if (han < 1 || han > 13) {
    throw new InvalidHanFuError(han, fu)
  }
}

// ===== エラーロギング =====

export function logError(error: unknown, context: string, metadata?: any): void {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    metadata
  }

  console.error(`[${timestamp}] ${context}:`, JSON.stringify(logData, null, 2))
}

// ===== 型ガード =====

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function isValidationError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError
}

// ===== デバッグユーティリティ =====

export function getErrorDetails(error: unknown): {
  type: string
  message: string
  code?: ErrorCode
  details?: any
} {
  if (error instanceof AppError) {
    return {
      type: 'AppError',
      message: error.message,
      code: error.code,
      details: error.details
    }
  }
  
  if (error instanceof z.ZodError) {
    return {
      type: 'ZodError',
      message: 'Validation failed',
      details: error.errors
    }
  }
  
  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: error.message
    }
  }
  
  return {
    type: 'Unknown',
    message: String(error)
  }
}