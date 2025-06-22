import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPoints(points: number): string {
  return points.toLocaleString()
}

export function getRoundName(round: number): string {
  const winds = ['東', '南', '西', '北']
  const windIndex = Math.floor((round - 1) / 4)
  const roundNumber = ((round - 1) % 4) + 1
  return `${winds[windIndex]}${roundNumber}局`
}

export function getPositionName(position: number): string {
  const positions = ['東', '南', '西', '北']
  return positions[position] || '不明'
}

export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function calculatePointDifference(currentPoints: number, startingPoints: number = 25000): number {
  return currentPoints - startingPoints
}