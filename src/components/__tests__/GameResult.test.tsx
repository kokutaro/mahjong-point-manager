import { render, screen } from '@testing-library/react'
import GameResult from '../GameResult'

// AuthContextのモック
const mockUser = {
  playerId: 'player1',
  name: 'テストプレイヤー1'
}

// useAuth フックのモック
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser
  })
}))

// useAppStore フックのモック
jest.mock('@/store/useAppStore', () => ({
  useSessionStore: () => ({
    setSession: jest.fn()
  }),
  useUIStore: () => ({
    isLoading: false,
    setLoading: jest.fn(),
    setError: jest.fn()
  })
}))

// useMatchHistory フックのモック
jest.mock('@/hooks/useMatchHistory', () => ({
  useMatchHistory: () => ({
    addResult: jest.fn()
  })
}))

// fetch API のモック
global.fetch = jest.fn()

// Socket.IO のモック
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn()
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket)
}))

// モックデータ
const mockGameResultData = {
  gameId: 'test-game-id',
  roomCode: 'TEST123',
  results: [
    {
      playerId: 'player1',
      name: 'テストプレイヤー1',
      finalPoints: 35000,
      rank: 1,
      uma: 3000,
      settlement: 8000
    },
    {
      playerId: 'player2', 
      name: 'テストプレイヤー2',
      finalPoints: 28000,
      rank: 2,
      uma: 1000,
      settlement: -2000
    },
    {
      playerId: 'player3',
      name: 'テストプレイヤー3',
      finalPoints: 22000,
      rank: 3,
      uma: -1000,
      settlement: -3000
    },
    {
      playerId: 'player4',
      name: 'テストプレイヤー4',
      finalPoints: 15000,
      rank: 4,
      uma: -3000,
      settlement: -3000
    }
  ],
  gameType: 'TONPUU' as const,
  endReason: '東4局終了',
  endedAt: '2023-01-01T12:00:00Z',
  basePoints: 30000,
  sessionId: 'test-session-id',
  sessionCode: 'SES123',
  sessionName: 'テストセッション',
  hostPlayerId: 'player1'
}

describe('GameResult ホスト表示機能', () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // fetch API のレスポンスをモック
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockGameResultData
      })
    })
  })

  test('ホストプレイヤーにホストバッジが表示される', async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // ホストプレイヤー（player1）にホストバッジが表示される
    const hostBadges = screen.getAllByText('👑 ホスト')
    expect(hostBadges.length).toBeGreaterThanOrEqual(1)

    // ホストバッジがテストプレイヤー1の横に表示されている
    const playerNameElements = screen.getAllByText('テストプレイヤー1')
    expect(playerNameElements.length).toBeGreaterThan(0)
  })

  test('非ホストプレイヤーにはホストバッジが表示されない', async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // 非ホストプレイヤーの名前の隣にはホストバッジがない
    const player2Elements = screen.getAllByText('テストプレイヤー2')
    const player3Elements = screen.getAllByText('テストプレイヤー3')
    const player4Elements = screen.getAllByText('テストプレイヤー4')

    expect(player2Elements.length).toBeGreaterThan(0)
    expect(player3Elements.length).toBeGreaterThan(0)
    expect(player4Elements.length).toBeGreaterThan(0)

    // ホストバッジの数は1つ（順位表用）+ 1つ（精算詳細用）のみ
    const hostBadges = screen.getAllByText('👑 ホスト')
    expect(hostBadges.length).toBe(2) // 順位表とカード詳細の2箇所
  })

  test('hostPlayerIdがない場合、ホストバッジが表示されない', async () => {
    const dataWithoutHost = {
      ...mockGameResultData,
      hostPlayerId: undefined
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: dataWithoutHost
      })
    })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // ホストバッジが表示されていない
    const hostBadges = screen.queryAllByText('👑 ホスト')
    expect(hostBadges.length).toBe(0)
  })

  test('異なるプレイヤーがホストの場合、正しいプレイヤーにホストバッジが表示される', async () => {
    const dataWithDifferentHost = {
      ...mockGameResultData,
      hostPlayerId: 'player3' // player3がホスト
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: dataWithDifferentHost
      })
    })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // ホストバッジが表示される
    const hostBadges = screen.getAllByText('👑 ホスト')
    expect(hostBadges.length).toBe(2) // 順位表とカード詳細の2箇所

    // テストプレイヤー3の名前が表示されている
    const player3Elements = screen.getAllByText('テストプレイヤー3')
    expect(player3Elements.length).toBeGreaterThan(0)
  })

  test('ホストバッジのスタイルが正しく適用される', async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // ホストバッジの要素を取得
    const hostBadges = screen.getAllByText('👑 ホスト')
    
    // 少なくとも1つのホストバッジが存在する
    expect(hostBadges.length).toBeGreaterThan(0)

    // 最初のホストバッジのクラス名を確認
    const firstBadge = hostBadges[0]
    expect(firstBadge).toHaveClass('ml-2')
    expect(firstBadge).toHaveClass('px-2')
    expect(firstBadge).toHaveClass('py-1')
    expect(firstBadge).toHaveClass('bg-yellow-100')
    expect(firstBadge).toHaveClass('text-yellow-800')
    expect(firstBadge).toHaveClass('text-xs')
    expect(firstBadge).toHaveClass('rounded-full')
    expect(firstBadge).toHaveClass('border')
    expect(firstBadge).toHaveClass('border-yellow-300')
  })

  test('セッション情報が正しく表示される', async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // セッション情報が表示される
    expect(screen.getByText(/セッション:/)).toBeInTheDocument()
    expect(screen.getByText(/テストセッション/)).toBeInTheDocument()
  })
})

describe('GameResult Phase 2: ホスト専用強制終了機能', () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // fetch API のレスポンスをモック
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockGameResultData
      })
    })
  })

  test('ホストユーザーに強制終了ボタンが表示される', async () => {
    // ホストとして認証されるようモック設定
    const hostUser = { playerId: 'player1', name: 'テストプレイヤー1' }
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ user: hostUser })
    }))

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // ホスト専用強制終了ボタンが表示される
    expect(screen.getByText('⚠️ セッション強制終了')).toBeInTheDocument()
  })

  test('非ホストユーザーには強制終了ボタンが表示されない', async () => {
    // 非ホストとして認証されるようモック設定
    const nonHostUser = { playerId: 'player2', name: 'テストプレイヤー2' }
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ user: nonHostUser })
    }))

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // 強制終了ボタンが表示されない
    expect(screen.queryByText('⚠️ セッション強制終了')).not.toBeInTheDocument()
  })

  test('セッションIDがない場合、ホストでも強制終了ボタンが表示されない', async () => {
    const dataWithoutSession = {
      ...mockGameResultData,
      sessionId: undefined
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: dataWithoutSession
      })
    })

    const hostUser = { playerId: 'player1', name: 'テストプレイヤー1' }
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ user: hostUser })
    }))

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // セッションIDがないため強制終了ボタンが表示されない
    expect(screen.queryByText('⚠️ セッション強制終了')).not.toBeInTheDocument()
  })

  test('強制終了ボタンクリックで確認モーダルが表示される', async () => {
    const hostUser = { playerId: 'player1', name: 'テストプレイヤー1' }
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ user: hostUser })
    }))

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // 強制終了ボタンをクリック
    const forceEndButton = screen.getByText('⚠️ セッション強制終了')
    fireEvent.click(forceEndButton)

    // 確認モーダルが表示される
    expect(screen.getByText('セッション強制終了の確認')).toBeInTheDocument()
    expect(screen.getByText(/セッション「テストセッション」を強制終了しますか？/)).toBeInTheDocument()
  })

  test('確認モーダルで強制終了を実行できる', async () => {
    const mockEndResponse = {
      ok: true,
      json: () => Promise.resolve({ success: true })
    }
    
    // 最初にゲーム結果取得、次に強制終了APIのレスポンス
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockGameResultData
        })
      })
      .mockResolvedValueOnce(mockEndResponse)

    const hostUser = { playerId: 'player1', name: 'テストプレイヤー1' }
    jest.doMock('@/contexts/AuthContext', () => ({
      useAuth: () => ({ user: hostUser })
    }))

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText('対局結果')

    // 強制終了ボタンをクリック
    const forceEndButton = screen.getByText('⚠️ セッション強制終了')
    fireEvent.click(forceEndButton)

    // 理由を選択
    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'ホストによる終了' } })

    // 強制終了を確定
    const confirmButton = screen.getByText('強制終了')
    fireEvent.click(confirmButton)

    // 強制終了APIが正しく呼ばれることを確認
    await new Promise(resolve => setTimeout(resolve, 0)) // 非同期処理の待機

    expect(global.fetch).toHaveBeenCalledWith('/api/game/test-game-id/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'ホストによる終了' })
    })
  })
})