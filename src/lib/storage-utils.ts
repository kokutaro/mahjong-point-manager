/**
 * LocalStorageユーティリティ関数
 */

/**
 * 容量制限エラーが発生した場合にLocalStorageをクリアする
 */
export function clearLocalStorageOnQuotaError() {
  try {
    // 古いデータを削除
    const keysToRemove = [
      "mahjong-app-store",
      "game_state",
      "player_preferences",
    ]

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch (err) {
        console.error(`Failed to remove ${key}:`, err)
      }
    })

    console.log("LocalStorage cleared due to quota exceeded")
  } catch (err) {
    console.error("Failed to clear localStorage:", err)
  }
}

/**
 * LocalStorageの使用量をチェックする
 */
export function checkLocalStorageUsage() {
  try {
    let totalSize = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length
      }
    }
    console.log(`LocalStorage usage: ${(totalSize / 1024).toFixed(2)} KB`)
    return totalSize
  } catch (err) {
    console.error("Failed to check localStorage usage:", err)
    return 0
  }
}

/**
 * 安全にLocalStorageに保存する
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (err) {
    console.error(`Failed to save to localStorage (${key}):`, err)

    if (err instanceof Error && err.name === "QuotaExceededError") {
      // 容量エラーの場合はクリアして再試行
      clearLocalStorageOnQuotaError()
      try {
        localStorage.setItem(key, value)
        return true
      } catch (retryErr) {
        console.error(
          `Failed to save after clearing localStorage (${key}):`,
          retryErr
        )
        return false
      }
    }
    return false
  }
}

/**
 * 安全にLocalStorageから取得する
 */
export function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (err) {
    console.error(`Failed to read from localStorage (${key}):`, err)
    return null
  }
}
