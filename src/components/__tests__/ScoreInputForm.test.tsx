import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MantineProvider } from "@mantine/core"
import ScoreInputForm from "../ScoreInputForm"

const players = [
  {
    playerId: "p1",
    name: "A",
    position: 0,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
  {
    playerId: "p2",
    name: "B",
    position: 1,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
  {
    playerId: "p3",
    name: "C",
    position: 2,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
  {
    playerId: "p4",
    name: "D",
    position: 3,
    points: 25000,
    isReach: false,
    isConnected: true,
  },
]

const gameState = {
  gameId: "g1",
  players,
  currentRound: 1,
  currentOya: 0,
  honba: 0,
  kyotaku: 0,
  gamePhase: "playing" as const,
}

describe("ScoreInputForm", () => {
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
        <ScoreInputForm
          gameState={gameState}
          actionType="tsumo"
          preselectedWinnerId="p1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      </MantineProvider>
    )

    fireEvent.click(screen.getByText("満貫"))
    fireEvent.click(screen.getByText("支払い"))

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
})
