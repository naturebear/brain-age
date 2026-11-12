export type Mode = 'pointer' | 'keyboard'
export type Trial = { sequence: number[]; response: number[]; onset: number; start: number; times: number[]; target?: boolean; gap?: number; timeout?: boolean }
export type Attempt = { id: string; kind: 'memory' | 'attention'; version: string; mode: Mode; device: string; trials: Trial[]; outside: number[]; flags: string[]; complete: boolean }
export type Session = { schemaVersion: 1; id: string; date: string; status: 'active' | 'partial' | 'complete'; sleep: string; sleepy: string; focus: string; attempts: Attempt[] }
export type Training = { schemaVersion: 1; id: string; date: string; kind: 'memory' | 'mindfulness'; summary: string }
export function shuffle<T>(items: T[], random = Math.random) {
  const output = [...items]
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[output[i], output[j]] = [output[j], output[i]]
  }
  return output
}
export function sequence(length: number) {
  return shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, length)
}
export function plan(kind: Attempt['kind'], practice: boolean, custom?: number[]) {
  const trial = (values: number[]): Trial => ({ sequence: values, response: [], onset: 0, start: 0, times: [] })
  if (kind === 'memory') {
    if (custom) return [trial(custom)]
    if (practice) return [trial([1, 5]), trial([7, 3])]
    const used = new Set<string>()
    return [3, 3, 4, 4, 5, 5, 6, 6].map(length => {
      let values = sequence(length)
      while (used.has(values.join())) values = sequence(length)
      used.add(values.join())
      return trial(values)
    })
  }
  const block = (yes: number, no: number) => shuffle([...Array<boolean>(yes).fill(true), ...Array<boolean>(no).fill(false)])
  const targets = practice ? block(6, 4) : Array.from({ length: 5 }, () => block(14, 6)).flat()
  const gaps = shuffle([ ...Array<number>(34).fill(1400), ...Array<number>(33).fill(1600), ...Array<number>(33).fill(1800)])
  return targets.map((target, index) => ({ ...trial([]), target, gap: gaps[index] }))
}
export function memory(trials: Trial[]) {
  const exact = trials.filter(t => t.sequence.every((value, i) => t.response[i] === value))
  return {
    exact: exact.length,
    positions: trials.reduce((sum, t) => sum + t.sequence.filter((value, i) => t.response[i] === value).length, 0),
    longest: Math.max(0, ...exact.map(t => t.sequence.length)),
    timeouts: trials.filter(t => t.timeout).length,
  }
}
export function attention(trials: Trial[]) {
  const responses = trials.filter(t => t.target && t.times[0] >= 100 && t.times[0] < 1000).map(t => t.times[0]).sort((a, b) => a - b)
  const quantile = (p: number) => {
    const at = (responses.length - 1) * p
    return responses[Math.floor(at)] + (responses[Math.ceil(at)] - responses[Math.floor(at)]) * (at % 1)
  }
  return {
    hits: responses.length, misses: trials.filter(t => t.target && !t.times.length).length,
    early: trials.filter(t => t.target && t.times[0] < 100).length,
    falseAlarms: trials.filter(t => !t.target && t.times.length).length,
    median: responses.length >= 10 ? quantile(.5) : null,
    iqr: responses.length >= 10 ? quantile(.75) - quantile(.25) : null,
  }
}
export function radar(session: Session) {
  const values = session.attempts.filter(a => a.complete)
  const m = values.findLast(a => a.kind === 'memory')
  const a = values.findLast(a => a.kind === 'attention')
  const ms = memory(m?.trials ?? [])
  const as = attention(a?.trials ?? [])
  return [
    { label: '序列复现', n: ms.exact, d: 8, attempt: m },
    { label: '位置记忆', n: ms.positions, d: 36, attempt: m },
    { label: '目标识别', n: as.hits, d: 70, attempt: a },
    { label: '干扰抑制', n: 30 - as.falseAlarms, d: 30, attempt: a },
  ].map(axis => ({
    ...axis,
    status: !axis.attempt ? 'pending' : axis.attempt.flags.length ? 'review' : 'ready',
    value: axis.attempt && !axis.attempt.flags.length ? axis.n / axis.d * 100 : null,
  }))
}
