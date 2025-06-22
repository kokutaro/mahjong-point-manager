'use client'

import { MatchResult } from '@/hooks/useMatchHistory'

interface MatchHistoryTableProps {
  history: MatchResult[]
}

export default function MatchHistoryTable({ history }: MatchHistoryTableProps) {
  if (history.length === 0) return null

  const players = Array.from(new Set(history.flatMap(m => m.scores.map(s => s.name))))

  return (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="px-2 py-1 border">プレイヤー</th>
            {history.map((_, idx) => (
              <th key={idx} className="px-2 py-1 border">第{idx + 1}回</th>
            ))}
            <th className="px-2 py-1 border">合計</th>
          </tr>
        </thead>
        <tbody>
          {players.map(name => {
            let cumulative = 0
            return (
              <tr key={name}>
                <td className="px-2 py-1 border font-medium">{name}</td>
                {history.map((h, idx) => {
                  const score = h.scores.find(s => s.name === name)
                  if (score) cumulative += score.points
                  return (
                    <td key={idx} className="px-2 py-1 border text-right">
                      {score ? score.points.toLocaleString() : '-'}
                    </td>
                  )
                })}
                <td className="px-2 py-1 border text-right font-semibold">
                  {cumulative.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
