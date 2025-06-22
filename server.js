const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { initSocket } = require('./src/lib/socketjs')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
const port = parseInt(process.env.PORT, 10) || 3000

// Next.jsアプリの初期化
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // HTTPサーバー作成
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Socket.IOサーバー初期化
  console.log('🔌 Initializing WebSocket server...')
  const io = initSocket(server)
  console.log('🔌 WebSocket server initialized:', !!io)
  console.log('🔌 Process WebSocket instance set during init:', !!process.__socketio)
  
  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket server initialized and ready`)
    console.log('🔌 Process WebSocket instance available after listen:', !!process.__socketio)
    
    // デバッグ: プロセスオブジェクトの内容を確認
    console.log('🔌 Process object keys:', Object.keys(process).filter(key => key.includes('socket')))
  })
})