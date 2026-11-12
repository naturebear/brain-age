import { shuffle } from './domain'

export const boardSizes = [4, 5, 6] as const
export type Columns = typeof boardSizes[number]
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Player = 0 | 1
type Card = { face: number; taken: boolean }
type Observation = { face: number; turn: number }
export type Game = {
  cards: Card[]
  open: number[]
  player: Player
  scores: [number, number]
  turn: number
  memory: Record<number, Observation>
  feedback: 'match' | 'miss' | null
}

export function newGame(columns: Columns, first: Player, random = Math.random): Game {
  const pairs = Array.from({ length: columns * 2 }, (_, face) => [face, face]).flat()
  return {
    cards: shuffle(pairs, random).map(face => ({ face, taken: false })),
    open: [], player: first, scores: [0, 0], turn: 0, memory: {}, feedback: null,
  }
}

export function flip(game: Game, index: number): Game {
  const card = game.cards[index]
  if (!card || card.taken || game.open.includes(index) || game.open.length >= 2) return game
  const open = [...game.open, index]
  return {
    ...game, open,
    memory: { ...game.memory, [index]: { face: card.face, turn: game.turn } },
    feedback: open.length === 2 ? game.cards[open[0]].face === card.face ? 'match' : 'miss' : null,
  }
}

export function settle(game: Game): Game {
  if (game.open.length !== 2) return game
  if (game.feedback === 'miss') {
    return { ...game, open: [], player: game.player === 0 ? 1 : 0, turn: game.turn + 1 }
  }
  const scores: Game['scores'] = [...game.scores]
  scores[game.player]++
  const cards = game.cards.map((card, index) => game.open.includes(index) ? { ...card, taken: true } : card)
  return { ...game, open: [], scores, cards }
}

export function chooseCard(game: Game, difficulty: Difficulty, random = Math.random): number | undefined {
  const available = game.cards.flatMap((card, i) => !card.taken && !game.open.includes(i) ? [i] : [])
  if (!available.length || game.open.length >= 2) return

  const pick = (indices: number[]) => indices[Math.floor(random() * indices.length)]
  // Decisions use only public observations and availability. Hidden faces stay unknown.
  const remembered = available.filter(index => {
    const observation = game.memory[index]
    if (!observation) return false
    if (difficulty === 'easy') return game.turn - observation.turn <= 2 && random() < .45
    return difficulty === 'hard' || game.turn - observation.turn <= 4
  })
  if (difficulty === 'hard' && random() < .06) return pick(available)

  const first = game.open[0]
  if (first !== undefined) {
    const match = remembered.find(index => game.memory[index].face === game.memory[first]?.face)
    if (match !== undefined) return match
  } else {
    const seen = new Set<number>()
    for (const index of remembered) {
      const face = game.memory[index].face
      if (seen.has(face)) return index
      seen.add(face)
    }
  }
  const unknown = available.filter(index => !remembered.includes(index))
  return pick(unknown.length ? unknown : available)
}
