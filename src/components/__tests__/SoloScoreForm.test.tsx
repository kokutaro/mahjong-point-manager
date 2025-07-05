import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MantineProvider } from "@mantine/core"
import SoloScoreForm from "../solo/SoloScoreForm"

const players = [
  { id: "p1", name: "A", position: 0, points: 25000, isReach: false },
  { id: "p2", name: "B", position: 1, points: 25000, isReach: false },
  { id: "p3", name: "C", position: 2, points: 25000, isReach: false },
  { id: "p4", name: "D", position: 3, points: 25000, isReach: false },
]

const gameState = {
  gameId: "g1",
  players,
  currentRound: 1,
  currentOya: 0,
  honba: 0,
  kyotaku: 0,
  status: "PLAYING" as const,
}

describe("SoloScoreForm", () => {
  const mockSubmit = jest.fn()
  const mockCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { result: { payments: { fromOya: 2000, fromKo: 1000 } } },
      }),
    }) as jest.Mock
  })

  it("submits tsumo score", async () => {
    render(
      <MantineProvider>
        <SoloScoreForm
          gameState={gameState}
          actionType="tsumo"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </MantineProvider>
    )

    fireEvent.click(screen.getByText("東 A (親)"))
    fireEvent.click(screen.getByText("満貫"))
    const payButton = await screen.findByText("支払い")
    fireEvent.click(payButton)

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        winnerId: "p1",
        han: 5,
        fu: 30,
        isTsumo: true,
        loserId: undefined,
      })
    )
  })

  it("submits ron score with loser selection", async () => {
    render(
      <MantineProvider>
        <SoloScoreForm
          gameState={gameState}
          actionType="ron"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </MantineProvider>
    )

    fireEvent.click(screen.getByText("東 A (親)"))
    fireEvent.click(screen.getByText("南 B"))
    fireEvent.click(screen.getByText("3翻"))
    fireEvent.click(screen.getByText("40符"))
    fireEvent.click(screen.getByText("支払い"))

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        winnerId: "p1",
        han: 3,
        fu: 40,
        isTsumo: false,
        loserId: "p2",
      })
    )
  })

  it("fetches score preview", async () => {
    render(
      <MantineProvider>
        <SoloScoreForm
          gameState={gameState}
          actionType="tsumo"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </MantineProvider>
    )

    fireEvent.click(screen.getByText("東 A (親)"))
    fireEvent.click(screen.getByText("2翻"))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/score/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          han: 2,
          fu: 30,
          isOya: true,
          isTsumo: true,
          honba: 0,
          kyotaku: 0,
        }),
      })
    })
  })
})
