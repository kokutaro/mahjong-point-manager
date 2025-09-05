import { render, screen, fireEvent } from "@testing-library/react"
import { YakuTable } from "@/components/yaku/YakuTable"
import type { Yaku } from "@/lib/mahjong/yaku"

const sample: Yaku[] = [
  {
    id: "tanyao",
    nameKey: "yaku.tanyao.name",
    aliases: ["タンヤオ", "たんやお", "tanyao", "断么九"],
    category: "kuisagari",
    value: { kind: "han", closed: 1, open: 1 },
    notesKey: "yaku.tanyao.note",
  },
  {
    id: "daisangen",
    nameKey: "yaku.daisangen.name",
    aliases: ["大三元", "だいさんげん", "daisangen"],
    category: "yakuman",
    value: { kind: "yakuman", rank: 1 },
    notesKey: "yaku.daisangen.note",
  },
]

describe("YakuTable", () => {
  it("renders and filters by search", () => {
    render(<YakuTable data={sample} />)

    // both shown initially
    expect(screen.getByText("断么九")).toBeInTheDocument()
    expect(screen.getByText("大三元")).toBeInTheDocument()

    // filter by query
    const input = screen.getByPlaceholderText("役名/別名で検索")
    fireEvent.change(input, { target: { value: "だいさんげん" } })

    expect(screen.queryByText("断么九")).not.toBeInTheDocument()
    expect(screen.getByText("大三元")).toBeInTheDocument()
  })

  it("filters by category and han", () => {
    render(<YakuTable data={sample} />)

    // filter to yakuman only
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "yakuman" },
    })
    expect(screen.queryByText("断么九")).not.toBeInTheDocument()
    expect(screen.getByText("大三元")).toBeInTheDocument()

    // filter to 1 han only
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "all" },
    })
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "1" },
    })
    expect(screen.getByText("断么九")).toBeInTheDocument()
    expect(screen.queryByText("大三元")).not.toBeInTheDocument()
  })
})
