import { render, screen, fireEvent } from '@testing-library/react'
import ForceEndConfirmModal from '../ForceEndConfirmModal'

describe('ForceEndConfirmModal', () => {
  const mockOnClose = jest.fn()
  const mockOnConfirm = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('モーダルが閉じている時は何も表示されない', () => {
    render(
      <ForceEndConfirmModal
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.queryByText('セッション強制終了の確認')).not.toBeInTheDocument()
  })

  test('モーダルが開いている時は確認ダイアログが表示される', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText('セッション強制終了の確認')).toBeInTheDocument()
    expect(screen.getByText('このセッションを強制終了しますか？')).toBeInTheDocument()
    expect(screen.getByText('この操作は取り消せません。全てのプレイヤーがセッションから退出します。')).toBeInTheDocument()
  })

  test('セッション名が提供された場合、セッション名が表示される', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        sessionName="テストセッション"
      />
    )

    // セッション名の部分をチェック
    expect(screen.getByText('テストセッション')).toBeInTheDocument()
    expect(screen.getByText(/を強制終了しますか？/)).toBeInTheDocument()
  })

  test('理由を選択していない場合、強制終了ボタンが無効', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const confirmButton = screen.getByText('強制終了')
    expect(confirmButton).toBeDisabled()
  })

  test('理由を選択すると強制終了ボタンが有効になる', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'ホストによる終了' } })

    const confirmButton = screen.getByText('強制終了')
    expect(confirmButton).not.toBeDisabled()
  })

  test('「その他」を選択した場合、カスタム理由入力欄が表示される', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'その他' } })

    expect(screen.getByPlaceholderText('詳細な理由を入力してください')).toBeInTheDocument()
  })

  test('「その他」選択時、カスタム理由を入力しないと強制終了ボタンが無効', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'その他' } })

    const confirmButton = screen.getByText('強制終了')
    expect(confirmButton).toBeDisabled()

    // カスタム理由を入力
    const customReasonInput = screen.getByPlaceholderText('詳細な理由を入力してください')
    fireEvent.change(customReasonInput, { target: { value: 'カスタム理由' } })

    expect(confirmButton).not.toBeDisabled()
  })

  test('キャンセルボタンをクリックするとonCloseが呼ばれる', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const cancelButton = screen.getByText('キャンセル')
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  test('強制終了ボタンをクリックすると選択した理由でonConfirmが呼ばれる', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'ホストによる終了' } })

    const confirmButton = screen.getByText('強制終了')
    fireEvent.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalledWith('ホストによる終了')
    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
  })

  test('「その他」選択時、カスタム理由でonConfirmが呼ばれる', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const reasonSelect = screen.getByRole('combobox')
    fireEvent.change(reasonSelect, { target: { value: 'その他' } })

    const customReasonInput = screen.getByPlaceholderText('詳細な理由を入力してください')
    fireEvent.change(customReasonInput, { target: { value: 'カスタム終了理由' } })

    const confirmButton = screen.getByText('強制終了')
    fireEvent.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalledWith('カスタム終了理由')
  })

  test('ローディング中はボタンが無効になり、ローディング表示される', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={true}
      />
    )

    const cancelButton = screen.getByText('キャンセル')
    const confirmButton = screen.getByText('処理中...')

    expect(cancelButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
    expect(screen.getByText('処理中...')).toBeInTheDocument()
  })

  test('ローディング中は理由選択も無効になる', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={true}
      />
    )

    const reasonSelect = screen.getByRole('combobox')
    expect(reasonSelect).toBeDisabled()
  })

  test('すべての定義済み理由がオプションとして表示される', () => {
    render(
      <ForceEndConfirmModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    )

    const predefinedReasons = [
      'ホストによる終了',
      '時間切れ',
      '技術的問題',
      'プレイヤー都合',
      'その他'
    ]

    predefinedReasons.forEach(reason => {
      expect(screen.getByText(reason)).toBeInTheDocument()
    })
  })
})