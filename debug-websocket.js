// WebSocket接続デバッグ用のスクリプト
console.log("=== WebSocket Debug Information ===")
console.log("NODE_ENV:", process.env.NODE_ENV)
console.log(
  "Current URL:",
  typeof window !== "undefined" ? window.location.href : "Server side"
)
console.log(
  "Protocol:",
  typeof window !== "undefined" ? window.location.protocol : "N/A"
)
console.log(
  "Hostname:",
  typeof window !== "undefined" ? window.location.hostname : "N/A"
)
console.log(
  "Port:",
  typeof window !== "undefined" ? window.location.port : "N/A"
)

if (typeof window !== "undefined") {
  // ブラウザ環境でのWebSocket接続テスト
  const testSocketConnection = () => {
    const socketUrl =
      process.env.NODE_ENV === "production"
        ? `${window.location.protocol}//${window.location.hostname}`
        : `${window.location.protocol}//${window.location.hostname}:${window.location.port || "3000"}`

    console.log("Testing WebSocket connection to:", socketUrl)

    // Socket.IOのテスト接続
    import("socket.io-client").then(({ io }) => {
      const testSocket = io(socketUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
      })

      testSocket.on("connect", () => {
        console.log("✅ WebSocket connection successful:", testSocket.id)
        testSocket.disconnect()
      })

      testSocket.on("connect_error", (error) => {
        console.log("❌ WebSocket connection failed:", error)
      })

      testSocket.on("disconnect", (reason) => {
        console.log("🔌 WebSocket disconnected:", reason)
      })
    })
  }

  // ページロード後にテスト実行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", testSocketConnection)
  } else {
    testSocketConnection()
  }
}

module.exports = {
  testSocketConnection: () => console.log("WebSocket debug loaded"),
}
