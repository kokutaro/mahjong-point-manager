import { render, screen, fireEvent } from "@testing-library/react"
import QRCodeModal from "../QRCodeModal"

describe("QRCodeModal", () => {
  const mockOnClose = jest.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("モーダルの表示/非表示", () => {
    it("isOpenがfalseの時は何も表示されない", () => {
      render(<QRCodeModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText("QRコード")).not.toBeInTheDocument()
      expect(screen.queryByText("閉じる")).not.toBeInTheDocument()
    })

    it("isOpenがtrueの時にモーダルが表示される", () => {
      render(<QRCodeModal {...defaultProps} />)

      expect(screen.getByText("QRコード")).toBeInTheDocument()
      expect(screen.getByText("閉じる")).toBeInTheDocument()
    })

    it("モーダルのオーバーレイが正しく表示される", () => {
      render(<QRCodeModal {...defaultProps} />)

      const overlay = document.querySelector(
        ".fixed.inset-0.bg-black.bg-opacity-50"
      )
      expect(overlay).toBeInTheDocument()
    })

    it("モーダルコンテンツが正しく表示される", () => {
      render(<QRCodeModal {...defaultProps} />)

      const modalContent = document.querySelector(".bg-white.rounded-lg")
      expect(modalContent).toBeInTheDocument()
      expect(modalContent).toHaveClass("max-w-sm", "w-full", "mx-4")
    })
  })

  describe("QRコードデータありの場合", () => {
    const qrCodeData = "https://example.com/room/ABC123"

    it("QRコードデータがある場合に適切なメッセージが表示される", () => {
      render(<QRCodeModal {...defaultProps} qrCodeData={qrCodeData} />)

      expect(screen.getByText("QRコードで共有")).toBeInTheDocument()
    })

    it("QRコード表示エリアが表示される", () => {
      render(<QRCodeModal {...defaultProps} qrCodeData={qrCodeData} />)

      // より具体的にQRコード表示エリアを特定
      const qrCodeContainer = document.querySelector(
        ".w-48.h-48.mx-auto.bg-gray-200"
      )
      expect(qrCodeContainer).toBeInTheDocument()
      expect(qrCodeContainer).toHaveClass(
        "w-48",
        "h-48",
        "mx-auto",
        "bg-gray-200"
      )
      expect(qrCodeContainer).toHaveTextContent("QRコード")
    })

    it("QRコード背景エリアが正しいスタイルで表示される", () => {
      render(<QRCodeModal {...defaultProps} qrCodeData={qrCodeData} />)

      const backgroundArea = document.querySelector(".bg-gray-100.p-4.rounded")
      expect(backgroundArea).toBeInTheDocument()
    })
  })

  describe("QRコードデータなしの場合", () => {
    it("QRコードデータがない場合にエラーメッセージが表示される", () => {
      render(<QRCodeModal {...defaultProps} />)

      expect(screen.getByText("QRコードデータがありません")).toBeInTheDocument()
    })

    it("QRコードデータがundefinedの場合にエラーメッセージが表示される", () => {
      render(<QRCodeModal {...defaultProps} qrCodeData={undefined} />)

      expect(screen.getByText("QRコードデータがありません")).toBeInTheDocument()
    })

    it("QRコードデータが空文字の場合にエラーメッセージが表示される", () => {
      render(<QRCodeModal {...defaultProps} qrCodeData="" />)

      expect(screen.getByText("QRコードデータがありません")).toBeInTheDocument()
    })

    it("QRコードデータがない場合は共有メッセージが表示されない", () => {
      render(<QRCodeModal {...defaultProps} />)

      expect(screen.queryByText("QRコードで共有")).not.toBeInTheDocument()
    })
  })

  describe("ボタンの動作", () => {
    it("ヘッダーの✕ボタンをクリックするとonCloseが呼ばれる", () => {
      render(<QRCodeModal {...defaultProps} />)

      const closeButton = screen.getByText("✕")
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("フッターの閉じるボタンをクリックするとonCloseが呼ばれる", () => {
      render(<QRCodeModal {...defaultProps} />)

      const closeButton = screen.getByText("閉じる")
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("ヘッダーの✕ボタンに正しいスタイルが適用されている", () => {
      render(<QRCodeModal {...defaultProps} />)

      const closeButton = screen.getByText("✕")
      expect(closeButton).toHaveClass("text-gray-500", "hover:text-gray-700")
    })

    it("フッターの閉じるボタンに正しいスタイルが適用されている", () => {
      render(<QRCodeModal {...defaultProps} />)

      const closeButton = screen.getByText("閉じる")
      expect(closeButton).toHaveClass(
        "w-full",
        "bg-blue-600",
        "text-white",
        "py-2",
        "px-4",
        "rounded",
        "hover:bg-blue-700"
      )
    })
  })

  describe("レイアウトとスタイル", () => {
    it("ヘッダーが正しく表示される", () => {
      render(<QRCodeModal {...defaultProps} />)

      const header = screen.getByText("QRコード").closest("div")
      expect(header).toHaveClass(
        "flex",
        "justify-between",
        "items-center",
        "mb-4"
      )
    })

    it("タイトルに正しいスタイルが適用されている", () => {
      render(<QRCodeModal {...defaultProps} />)

      const title = screen.getByText("QRコード")
      expect(title.tagName).toBe("H2")
      expect(title).toHaveClass("text-lg", "font-semibold")
    })

    it("コンテンツエリアが中央寄せで表示される", () => {
      render(<QRCodeModal {...defaultProps} />)

      const contentArea = screen.getByText("閉じる").closest("div")
      expect(contentArea).toHaveClass("text-center")
    })

    it("z-indexが正しく設定されている", () => {
      render(<QRCodeModal {...defaultProps} />)

      const overlay = document.querySelector(".fixed.inset-0")
      expect(overlay).toHaveClass("z-50")
    })
  })

  describe("アクセシビリティ", () => {
    it("ボタンがキーボードでアクセス可能", () => {
      render(<QRCodeModal {...defaultProps} />)

      const closeButtons = screen.getAllByRole("button")
      expect(closeButtons).toHaveLength(2)

      closeButtons.forEach((button) => {
        expect(button.tagName).toBe("BUTTON")
      })
    })

    it("モーダルタイトルがheadingとして認識される", () => {
      render(<QRCodeModal {...defaultProps} />)

      const heading = screen.getByRole("heading", { name: "QRコード" })
      expect(heading).toBeInTheDocument()
    })
  })

  describe("条件分岐のテスト", () => {
    it("QRコードデータが存在する場合のみQRコード表示エリアが描画される", () => {
      const { rerender } = render(<QRCodeModal {...defaultProps} />)

      // データなしの場合
      expect(screen.queryByText("QRコードで共有")).not.toBeInTheDocument()
      expect(screen.getByText("QRコードデータがありません")).toBeInTheDocument()

      // データありの場合
      rerender(<QRCodeModal {...defaultProps} qrCodeData="test-data" />)

      expect(screen.getByText("QRコードで共有")).toBeInTheDocument()
      expect(
        screen.queryByText("QRコードデータがありません")
      ).not.toBeInTheDocument()
    })
  })
})
