import { expect, test } from 'vitest'
import { boardSizes, chooseCard, flip, newGame, settle } from './cardGame'

const ordered = () => .99

test.each(boardSizes)('4×%i contains exactly two of each face', columns => {
  const game = newGame(columns, 0)
  expect(game.cards).toHaveLength(columns * 4)
  for (let face = 0; face < columns * 2; face++) {
    expect(game.cards.filter(card => card.face === face)).toHaveLength(2)
  }
})

test('pairs award a point and retain the turn; misses switch players', () => {
  const start = newGame(4, 0, ordered)
  const one = flip(start, 0)
  expect(flip(one, 0)).toBe(one)
  const pair = flip(one, 1)
  expect(flip(pair, 2)).toBe(pair)
  const matched = settle(pair)
  expect(matched).toMatchObject({ scores: [1, 0], player: 0, open: [] })
  expect(flip(matched, 0)).toBe(matched)
  const missed = settle(flip(flip(matched, 2), 4))
  expect(missed).toMatchObject({ scores: [1, 0], player: 1, open: [] })
  expect(missed.cards[2].taken).toBe(false)
})

test('hard AI uses observed pairs; older observations expire for medium AI', () => {
  const game = { ...newGame(4, 1, ordered), turn: 8, memory: { 0: { face: 0, turn: 1 }, 1: { face: 0, turn: 2 } } }
  const index = chooseCard(game, 'hard', ordered)
  expect(index).toBe(1)
  expect(chooseCard(flip(game, index!), 'hard', ordered)).toBe(0)
  expect(chooseCard(game, 'medium', ordered)).toBe(15)
  expect(chooseCard(game, 'easy', ordered)).toBe(15)
})
