import { useEffect, useRef, useState } from 'react'
import { attention, memory, plan, type Attempt, type Mode } from './domain'

type Props = { kind: Attempt['kind']; mode: Mode; practice?: boolean; custom?: number[]; done: (attempt: Attempt) => void }
export function Task({ kind, mode, practice = false, custom, done }: Props) {
  const [view, setView] = useState({ phase: '准备', index: 0, active: 0, count: 0, target: null as boolean | null })
  const callback = useRef(done)
  callback.current = done
  const response = useRef<(value: number) => void>(() => {})
  const exit = useRef(() => {})
  const total = custom ? 1 : kind === 'memory' ? practice ? 2 : 8 : practice ? 10 : 100
  useEffect(() => {
    const trials = plan(kind, practice, custom)
    const origin = performance.now()
    const attempt: Attempt = {
      id: crypto.randomUUID(), kind, mode, version: kind + '-v1', device: [navigator.userAgent, screen.width, screen.height].join('|'),
      trials: [], outside: [], flags: [], complete: false,
    }
    let timer = 0, frame = 0, stopped = false, index = 0
    let phase = '准备'
    const flag = (message: string) => { if (!attempt.flags.includes(message)) attempt.flags.push(message) }
    function cleanup() {
      stopped = true
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('blur', interrupt)
      window.removeEventListener('orientationchange', interrupt)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', keydown)
    }
    function finish(complete: boolean) {
      if (stopped) return
      attempt.complete = complete
      if (!complete) flag('测试被打断')
      if (kind === 'attention' && complete && !practice) {
        const responded = attempt.trials.filter(t => t.times.length)
        const early = responded.filter(t => t.times[0] < 100).length
        if (early > responded.length * .2 || attempt.outside.length > 20) flag('作答方式需要核对')
      }
      cleanup()
      callback.current(attempt)
    }
    const interrupt = () => finish(false)
    const hidden = () => { if (document.hidden) interrupt() }
    const width = window.innerWidth
    const resize = () => { if (Math.abs(window.innerWidth - width) > 5) interrupt() }
    function keydown(e: KeyboardEvent) {
      if (mode !== 'keyboard' || e.repeat || e.target instanceof HTMLButtonElement && e.target.dataset.control === 'exit') return
      const value = kind === 'attention' && e.code === 'Space' ? 1 : kind === 'memory' && /^[1-9]$/.test(e.key) ? Number(e.key) : 0
      if (value) { e.preventDefault(); response.current(value) }
    }
    function at(deadline: number, action: () => void, draw = false) {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        const run = () => {
          if (stopped) return
          if (performance.now() - deadline > 250) flag('呈现计时异常')
          action()
        }
        if (draw) frame = requestAnimationFrame(run)
        else run()
      }, Math.max(0, deadline - performance.now()))
    }
    function show(next: string, active = 0, count = 0, target: boolean | null = null) {
      phase = next
      setView({ phase, index, active, count, target })
    }
    function next() {
      index++
      if (index === trials.length) finish(true)
      else begin()
    }
    function begin() {
      const trial = trials[index]
      const start = performance.now()
      if (kind === 'memory') {
        show('准备')
        const present = (position: number, due: number) => {
          at(due, () => {
            trial.times.push(performance.now() - origin)
            show('观察', trial.sequence[position])
            at(due + 600, () => {
              show('观察')
              if (position + 1 < trial.sequence.length) present(position + 1, due + 900)
              else at(due + 900, () => {
                const opened = performance.now()
                trial.start = opened - origin
                trial.times = []
                show('作答')
                const submit = (timeout: boolean) => {
                  trial.timeout = timeout
                  attempt.trials.push(trial)
                  const correct = memory([trial]).exact === 1
                  show(practice || custom ? correct ? '正确' : '正确顺序：' + trial.sequence.join(' → ') : '下一题准备')
                  at(performance.now() + 800, next)
                }
                response.current = value => {
                  if (phase !== '作答' || performance.now() >= opened + 15000) return
                  trial.response.push(value)
                  trial.times.push(performance.now() - origin)
                  show('作答', 0, trial.response.length)
                  if (trial.response.length === trial.sequence.length) submit(false)
                }
                at(opened + 15000, () => submit(true))
              })
            }, true)
          }, true)
        }
        present(0, start + 500)
        return
      }
      at(start, () => {
        const onset = performance.now()
        trial.onset = onset - origin
        show('作答', 0, 0, trial.target ?? null)
        response.current = () => {
          const elapsed = performance.now() - onset
          if (elapsed < 1000) trial.times.push(elapsed)
          else attempt.outside.push(performance.now() - origin)
        }
        at(onset + 600, () => {
          show('等待')
          at(onset + 1000, () => {
            attempt.trials.push(trial)
            if (practice) {
              const score = attention([trial])
              show(trial.target ? score.hits ? '正确' : '圆形出现时请及时响应' : score.falseAlarms ? '三角形出现时请等待' : '正确')
            }
            at(onset + (trial.gap ?? 1600), next)
          })
        }, true)
      }, true)
    }
    response.current = () => { if (kind === 'attention') attempt.outside.push(performance.now() - origin) }
    exit.current = interrupt
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', interrupt)
    window.addEventListener('orientationchange', interrupt)
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', keydown)
    begin()
    return cleanup
  }, [kind, mode, practice, custom])
  return <section className="panel task">
    <div className="row"><span>{practice ? '练习' : '任务'} · {view.index + 1}/{total}</span><button className="quiet" data-control="exit" onClick={() => exit.current()}>退出任务</button></div>
    <h1>{kind === 'memory' ? '空间记忆' : '注意测评'}</h1>
    <p className="phase">{kind === 'memory' && view.phase === '作答' ? '按顺序复现 · 已输入 ' + view.count : kind === 'attention' && !practice ? '圆形出现时响应，三角形出现时等待' : view.phase}</p>
    {kind === 'memory' ? <div className="cells">{Array.from({ length: 9 }, (_, i) => <button key={i} className={view.active === i + 1 ? 'active' : ''} aria-label={'位置 ' + (i + 1)} onPointerDown={() => mode === 'pointer' && response.current(i + 1)}>{mode === 'keyboard' ? i + 1 : ''}</button>)}</div> :
      <><div className="stimulus">{view.target !== null && <span className={view.target ? 'circle' : 'triangle'} />}</div><button className="primary" onPointerDown={() => mode === 'pointer' && response.current(1)}>{mode === 'keyboard' ? '按空格响应' : '点击响应'}</button></>}
  </section>
}
