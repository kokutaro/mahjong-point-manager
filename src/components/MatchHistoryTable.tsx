'use client'

import { MatchResult } from '@/hooks/useMatchHistory'

interface MatchHistoryTableProps {
  history: MatchResult[]
}

export default function MatchHistoryTable({ history }: MatchHistoryTableProps) {
  if (history.length === 0) return null

  const players = Array.from(new Set(history.flatMap(m => m.scores.map(s => s.name))))
  const totals: Record<string, number> = {}
  players.forEach(name => { totals[name] = 0 })

  return (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="px-2 py-1 border">対局</th>
            {players.map(name => (
              <th key={name} className="px-2 py-1 border">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((match, idx) => (
            <tr key={match.gameId ?? idx}>
              <td className="px-2 py-1 border text-center">第{idx + 1}回</td>
              {players.map(name => {
                const score = match.scores.find(s => s.name === name)?.points
                if (score !== undefined) totals[name] += score
                return (
                  <td key={name} className="px-2 py-1 border text-right">
                    {score !== undefined ? score.toLocaleString() : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td className="px-2 py-1 border font-semibold">合計</td>
            {players.map(name => (
              <td key={name} className="px-2 py-1 border text-right font-semibold">
                {totals[name].toLocaleString()}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
