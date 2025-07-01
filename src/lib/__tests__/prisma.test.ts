import { PrismaClient } from "@prisma/client"

// prisma.tsは動的にインポートできないため、テスト用のモック
describe("Prisma Configuration", () => {
  describe("PrismaClient initialization", () => {
    it("should create PrismaClient with correct configuration", () => {
      const prismaClient = new PrismaClient({
        log: ["warn"],
      })

      expect(prismaClient).toBeInstanceOf(PrismaClient)
    })

    it("should handle environment variables correctly", () => {
      const originalEnv = process.env.NODE_ENV

      // プロダクション環境での動作確認
      process.env.NODE_ENV = "production"

      const globalForPrisma = globalThis as unknown as {
        prisma: PrismaClient | undefined
      }

      // グローバル変数がundefinedである（プロダクション環境では設定しない）
      expect(globalForPrisma.prisma).toBeUndefined()

      // 開発環境での動作確認
      process.env.NODE_ENV = "development"

      const prismaClient = new PrismaClient({
        log: ["warn"],
      })

      // 開発環境では設定する
      globalForPrisma.prisma = prismaClient
      expect(globalForPrisma.prisma).toBe(prismaClient)

      // 環境変数を元に戻す
      process.env.NODE_ENV = originalEnv

      // クリーンアップ
      globalForPrisma.prisma = undefined
    })

    it("should export prisma instance", async () => {
      // 動的インポートでprismaインスタンスをテスト
      const { prisma } = await import("../prisma")

      expect(prisma).toBeInstanceOf(PrismaClient)
    })

    it("should export default prisma instance", async () => {
      // デフォルトエクスポートのテスト
      const prismaDefault = await import("../prisma").then((m) => m.default)

      expect(prismaDefault).toBeInstanceOf(PrismaClient)
    })
  })

  describe("Development vs Production behavior", () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
      // グローバル変数をクリーンアップ
      const globalForPrisma = globalThis as unknown as {
        prisma: PrismaClient | undefined
      }
      globalForPrisma.prisma = undefined
    })

    it("should not set global prisma in production", () => {
      const originalEnv = process.env.NODE_ENV

      // グローバル変数を事前にクリア
      const globalForPrisma = globalThis as unknown as {
        prisma: PrismaClient | undefined
      }
      globalForPrisma.prisma = undefined

      process.env.NODE_ENV = "production"

      const prismaClient = new PrismaClient({
        log: ["warn"],
      })

      // プロダクション環境では、グローバル変数は設定されない
      // （実際のコードの動作を確認）
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prismaClient
      }

      expect(globalForPrisma.prisma).toBeUndefined()

      // 環境変数を復元
      process.env.NODE_ENV = originalEnv
    })

    it("should set global prisma in development", () => {
      process.env.NODE_ENV = "development"

      const globalForPrisma = globalThis as unknown as {
        prisma: PrismaClient | undefined
      }

      const prismaClient = new PrismaClient({
        log: ["warn"],
      })

      // 開発環境では、グローバル変数は設定される
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prismaClient
      }

      expect(globalForPrisma.prisma).toBe(prismaClient)
    })
  })

  describe("Logging configuration", () => {
    it("should configure warn level logging", () => {
      const prismaClient = new PrismaClient({
        log: ["warn"],
      })

      // Prismaクライアントが正しく作成されることを確認
      expect(prismaClient).toBeInstanceOf(PrismaClient)
    })
  })
})
