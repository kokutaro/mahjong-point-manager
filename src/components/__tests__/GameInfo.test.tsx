import { render, screen } from "@testing-library/react"
import GameInfo from "../GameInfo"

const baseState = {
  gameId: "g1",
  players: [
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
  ],
  currentRound: 1,
  currentOya: 0,
  honba: 1,
  kyotaku: 2,
  gamePhase: "playing" as const,
}

describe("GameInfo", () => {
  it("renders round name and dealer", () => {
    render(<GameInfo gameState={baseState} isConnected gameType="TONPUU" />)

    expect(screen.getAllByText("東一局")[0]).toBeInTheDocument()
    expect(screen.getByText("親: 東 A")).toBeInTheDocument()
    expect(screen.getByText("供託 2本")).toBeInTheDocument()
  })

  it("shows disconnected status", () => {
    render(
      <GameInfo gameState={baseState} isConnected={false} gameType="TONPUU" />
    )

    expect(screen.getByText("切断")).toBeInTheDocument()
  })
})
