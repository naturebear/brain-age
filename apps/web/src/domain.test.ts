import { describe, expect, it } from 'vitest'
import { attention, memory, plan, radar, type Session } from './domain'

describe('正式测评', () => {
  it('保持八条空间序列与 36 个计分位置', () => {
    const trials = plan('memory', false)
    expect(new Set(trials.map(t => t.sequence.join())).size).toBe(8)
    expect(memory(trials.map(t => ({ ...t, response: t.sequence })))).toEqual({ exact: 8, positions: 36, longest: 6, timeouts: 0 })
  })
  it('每 20 个注意试次含 14 个目标并正确处理反应边界', () => {
    const trials = plan('attention', false)
    expect(trials).toHaveLength(100)
    for (let i = 0; i < 100; i += 20) expect(trials.slice(i, i + 20).filter(t => t.target)).toHaveLength(14)
    const targets = trials.filter(t => t.target)
    expect(attention([99, 100, 999].map((time, i) => ({ ...targets[i], times: [time] })))).toMatchObject({ hits: 2, early: 1, median: null })
  })
  it('将零分、未完成和建议重测分别呈现', () => {
    const session: Session = { schemaVersion: 1, id: 's', date: '', status: 'partial', sleep: '', sleepy: '', focus: '', attempts: [{ id: 'a', kind: 'memory', version: 'memory-v1', mode: 'pointer', device: '', trials: plan('memory', false), outside: [], flags: [], complete: true }] }
    expect(radar(session).map(a => [a.status, a.value])).toEqual([['ready', 0], ['ready', 0], ['pending', null], ['pending', null]])
    session.attempts[0].flags.push('呈现计时异常')
    expect(radar(session)[0]).toMatchObject({ status: 'review', value: null })
  })
})
