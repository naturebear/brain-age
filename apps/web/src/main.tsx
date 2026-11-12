import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { attention, memory, radar, sequence, type Mode, type Attempt, type Session, type Training } from './domain'
import { Task } from './Task'
import { MemoryCards } from './MemoryCards'
import './style.css'

const prefix = 'brainage.v1.'
type RecordData = Session | Training
const cache = new Map<string, RecordData>()
const unsaved = new Set<string>()
let storageError = false
function records(): RecordData[] {
  const data = new Map(cache)
  try {
    for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (value?.schemaVersion === 1 && typeof value.date === 'string' && typeof value.id === 'string' && (Array.isArray(value.attempts) || typeof value.summary === 'string') && !data.has(value.id)) data.set(value.id, value)
        else if (!value || value.schemaVersion !== 1) storageError = true
      } catch { storageError = true }
    }
  } catch { storageError = true }
  return [...data.values()].sort((a, b) => b.date.localeCompare(a.date))
}
function save(record: RecordData) {
  cache.set(record.id, record)
  try { localStorage.setItem(prefix + record.id, JSON.stringify(record)); unsaved.delete(record.id); return true }
  catch { storageError = true; unsaved.add(record.id); return false }
}
function clear() {
  try { Object.keys(localStorage).filter(key => key.startsWith(prefix)).forEach(key => localStorage.removeItem(key)); cache.clear(); unsaved.clear(); return true }
  catch { return false }
}
const fmt = (value: number) => Number(value.toFixed(1))
const date = (value: string) => new Date(value).toLocaleString('zh-CN')
const title = (kind: Attempt['kind']) => kind === 'memory' ? '空间记忆' : '注意测评'

function Home() {
  const latest = records().find(record => 'attempts' in record && record.status !== 'active')
  return <><section className="hero"><div><p className="eyebrow">认知练习 · 个人记录</p><h1>给注意力，<br />一段安静的时间。</h1><p>从一次简短测评开始，了解此刻的表现。</p><Link className="primary" to="/assessment/setup">开始测评 →</Link><p className="small">约 5–8 分钟 · 免登录体验</p></div><div className="panel"><h2>空间记忆</h2><p>记住点亮的位置，按顺序复现。</p><div className="cells demo" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} className={i === 4 ? 'active' : ''} />)}</div></div></section><div className="row panel"><div><h2>练习专注</h2><p>{latest ? '最近一次测评 · ' + date(latest.date) : '空间记忆与五分钟正念练习。'}</p></div><Link to="/training">查看练习 →</Link></div></>
}
function Setup({ start }: { start: (s: Session) => void }) {
  const navigate = useNavigate()
  return <section className="panel narrow"><h1>开始测评</h1><p>约 5–8 分钟。请在安静的环境下进行，任务前可选择触屏、鼠标或键盘。</p><p>记录保存在当前浏览器。清理浏览器数据或更换设备后，记录可能无法访问。</p>
    <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); start({ schemaVersion: 1, id: crypto.randomUUID(), date: new Date().toISOString(), status: 'active', sleep: String(data.get('sleep')), sleepy: String(data.get('sleepy')), focus: String(data.get('focus')), attempts: [] }); navigate('/assessment/run') }}>
      <label>昨晚睡眠时长（小时）<input name="sleep" type="number" min="0" max="24" step=".5" placeholder="可跳过" /></label>
      <label>当前困倦程度<select name="sleepy"><option value="">可跳过</option>{['非常清醒', '比较清醒', '一般', '比较困倦', '非常困倦'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>当前主观专注<select name="focus"><option value="">可跳过</option>{['很难专注', '较难专注', '一般', '比较专注', '非常专注'].map(v => <option key={v}>{v}</option>)}</select></label>
      <button className="primary">继续</button>
    </form></section>
}
function Radar({ session, animate = false }: { session: Session; animate?: boolean }) {
  const axes = radar(session)
  const [index, setIndex] = useState(0)
  const axis = axes[index]
  const point = (i: number, value: number) => [180 + [0, 1, 0, -1][i] * value, 151 + [-1, 0, 1, 0][i] * value]
  const shape = (values: number[]) => values.map((value, i) => point(i, value).join(',')).join(' ')
  const ready = axes.filter(a => a.status === 'ready').length
  const label = (a: typeof axis) => a.status === 'review' ? '建议重测' : a.value === null ? '待完成' : fmt(a.value) + '%'
  return <section className="radar">
    <div className="row"><span>任务表现雷达</span><span>已点亮 {ready}/4</span></div>
    <div className="radar-layout">
      <svg viewBox="0 0 360 306" role="img" aria-label={axes.map(a => a.label + ' ' + label(a)).join('，')}>
        {[25, 50, 75, 100].map(v => <g key={v}><polygon points={shape([v, v, v, v])} fill="none" stroke="#527166" /><text x="185" y={154 - v} fill="#a8c0b5" fontSize="10">{v}</text></g>)}
        {axes.map((a, i) => { const [x, y] = point(i, 100); return <line key={a.label} x1="180" y1="151" x2={x} y2={y} stroke="#527166" /> })}
        {ready === 4 && <polygon points={shape(axes.map(a => a.value ?? 0))} fill="#77e1ba22" stroke="#77e1ba" strokeWidth="2" />}
        {axes.map((a, i) => { const [x, y] = point(i, a.value ?? 0); const [lx, ly] = [[180, 19], [318, 145], [180, 275], [42, 145]][i]; const color = a.status === 'ready' ? '#77e1ba' : a.status === 'review' ? '#ebc27b' : '#a8c0b5'; return <g key={a.label} fill={color}>{a.value !== null && <g className={animate ? 'radar-point' : undefined}><line x1="180" y1="151" x2={x} y2={y} stroke={color} strokeWidth="2" /><circle cx={x} cy={y} r="4" /></g>}<text x={lx} y={ly} textAnchor="middle" fontSize="12">{a.label}</text><text x={lx} y={ly + 16} textAnchor="middle" fontSize="12">{label(a)}</text></g> })}
      </svg>
      <div className="axis-list">{axes.map((a, i) => <button key={a.label} aria-pressed={i === index} onClick={() => setIndex(i)}><span>{a.label}</span><strong>{label(a)}</strong></button>)}<p aria-live="polite">{axis.value !== null ? axis.label + ' · ' + axis.n + '/' + axis.d + ' 次正确' : axis.status === 'review' ? axis.attempt?.flags.join('、') : '完成对应测评后点亮。'}</p></div>
    </div><p>2 项任务 · 4 个表现指标。各轴为本次任务的正确比例，指标可能相关。</p></section>
}
function Run({ session, update }: { session?: Session; update: (s: Session) => void }) {
  const [phase, setPhase] = useState('intro')
  const [mode, setMode] = useState<Mode>('pointer')
  const [passed, setPassed] = useState(false)
  const navigate = useNavigate()
  if (!session) return <Navigate to="/assessment/setup" replace />
  if (session.status !== 'active') return <Navigate to={'/results/' + session.id} replace />
  const kind = session.attempts.some(a => a.kind === 'memory' && a.complete) ? 'attention' : 'memory'
  const end = (s: Session) => { update(s); navigate('/results/' + s.id, { state: { fresh: s.status === 'complete' } }) }
  if (phase === 'between') return <><h1>空间记忆已完成</h1><p>完成 1/2 项测评</p><Radar session={session} animate /><div className="row"><button className="primary" onClick={() => setPhase('intro')}>继续注意测评</button><button onClick={() => end({ ...session, status: 'partial' })}>结束测评</button></div></>
  if (phase === 'practice' || phase === 'formal') return <Task key={phase + kind} kind={kind} mode={mode} practice={phase === 'practice'} done={a => {
    if (phase === 'practice') {
      const as = attention(a.trials)
      setPassed(a.complete && (kind === 'memory' ? memory(a.trials).exact === 2 : as.hits + 4 - as.falseAlarms >= 8))
      setPhase(a.complete ? 'practice-end' : 'interrupted')
      return
    }
    const next: Session = { ...session, attempts: [...session.attempts, a] }
    if (!a.complete) { update(next); setPassed(false); setPhase('interrupted') }
    else if (kind === 'memory') { update(next); setPassed(false); setPhase('between') }
    else end({ ...next, status: 'complete' })
  }} />
  return <section className="panel narrow"><h1>{phase === 'interrupted' ? '测试被打断' : title(kind)}</h1><p>{kind === 'memory' ? '观察九宫格的点亮顺序，结束后按原顺序复现。键盘模式使用数字 1–9。' : '看到圆形时响应，看到三角形时等待。键盘模式使用空格。'}</p>
    {phase === 'practice-end' && <p role="status">{passed ? '练习通过，可以开始正式测评。' : '请再练习一次，熟悉操作。'}</p>}
    <label>输入方式<select value={mode} onChange={e => { setMode(e.target.value as Mode); setPassed(false) }}><option value="pointer">触屏或鼠标</option><option value="keyboard">键盘</option></select></label>
    <div className="row"><button className="primary" onClick={() => setPhase(passed ? 'formal' : 'practice')}>{passed ? '开始正式测评' : '开始练习'}</button>{passed && <button onClick={() => setPhase('practice')}>再练一次</button>}<button onClick={() => end({ ...session, status: 'partial' })}>结束测评</button></div></section>
}
function Result() {
  const { id } = useParams()
  const location = useLocation()
  const s = records().find((r): r is Session => r.id === id && 'attempts' in r)
  const [retry, setRetry] = useState<boolean>()
  if (!s) return <section className="panel"><h1>记录不可用</h1><Link to="/history">返回记录页</Link></section>
  const completed = s.attempts.filter(a => a.complete)
  const m = completed.find(a => a.kind === 'memory')
  const a = completed.find(a => a.kind === 'attention')
  const ms = m && memory(m.trials)
  const as = a && attention(a.trials)
  const saved = retry ?? (() => { try { return !unsaved.has(s.id) && Boolean(localStorage.getItem(prefix + s.id)) } catch { return false } })()
  return <><p className="eyebrow">个人认知记录</p><h1>{s.status === 'complete' ? saved ? '本次表现已记录' : '本次测评已完成' : '部分测评结果'}</h1><p>完成 {completed.length}/2 项测评</p>{!saved && <p role="alert">本次记录尚未保存，离开页面后可能丢失。 <button onClick={() => setRetry(save(s))}>重试保存</button></p>}<Radar session={s} animate={location.state?.fresh === true && performance.getEntriesByType('navigation').every(entry => (entry as PerformanceNavigationTiming).type !== 'reload')} />
    <section className="panel"><h2>原始结果</h2>{ms && <p>空间记忆 · 完整复现 {ms.exact}/8 · 位置正确 {ms.positions}/36 · 最高成功长度 {ms.longest || '—'} · 超时 {ms.timeouts} 次</p>}{as && <p>注意表现 · 命中 {as.hits}/70 · 遗漏 {as.misses} · 过早 {as.early} · 误按 {as.falseAlarms} · 反应时间 {as.median === null ? '有效反应不足' : fmt(as.median) + ' ms · IQR ' + fmt(as.iqr ?? 0) + ' ms'}</p>}
    {completed.map(current => { const previous = records().flatMap(r => 'attempts' in r && r.id !== s.id && r.date < s.date ? r.attempts : []).find(p => p.complete && !p.flags.length && !current.flags.length && p.kind === current.kind && p.version === current.version && p.mode === current.mode && p.device === current.device); return <p key={current.id}>{title(current.kind)} · {previous ? '相较上次正确表现 ' + fmt(current.kind === 'memory' ? (memory(current.trials).exact - memory(previous.trials).exact) / 8 * 100 : (attention(current.trials).hits - attention(previous.trials).hits) / 70 * 100) + ' 个百分点' : '暂无可比较记录'}</p> })}
    <p>状态记录 · 睡眠 {s.sleep ? s.sleep + ' 小时' : '未填写'} · {s.sleepy || '困倦未填写'} · {s.focus || '专注未填写'}</p><p>重复练习、设备和当天状态会影响表现。</p></section><div className="row"><Link className="primary" to="/training">选择练习</Link><Link to="/history">我的记录</Link></div></>
}
function saveCardGame(summary: string) {
  return save({ schemaVersion: 1, id: crypto.randomUUID(), date: new Date().toISOString(), kind: 'cards', summary })
}

function TrainingMenu() {
  return <><h1>练习专注</h1><div className="hero"><section className="panel"><h2>空间记忆练习</h2><p>最多 12 题，难度随答题表现变化。</p><Link className="primary" to="/training/memory">开始空间记忆</Link></section><section className="panel"><h2>五分钟正念</h2><p>留意自然呼吸，发现走神后把注意带回来。</p><Link className="primary" to="/training/mindfulness">开始正念</Link></section><section className="panel"><h2>「神经衰弱」记忆翻牌</h2><p>记住扑克牌的位置，与电脑或身边的朋友比拼配对。</p><Link className="primary" to="/training/cards">开始记忆翻牌</Link></section></div></>
}
function MemoryTraining() {
  const [level, setLevel] = useState(3)
  const [streak, setStreak] = useState(0)
  const [count, setCount] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [highest, setHighest] = useState(0)
  const [current, setCurrent] = useState<number[]>()
  const [feedback, setFeedback] = useState('')
  const [finished, setFinished] = useState<string>()
  function finish(total: number, right: number, top: number) {
    const summary = '完成 ' + total + '/12 题 · 正确 ' + right + ' 题 · 最高练习长度 ' + (top || '—')
    const saved = save({ schemaVersion: 1, id: crypto.randomUUID(), date: new Date().toISOString(), kind: 'memory', summary })
    setFinished(summary + (saved ? '' : ' · 尚未保存'))
  }
  return <section className="panel narrow"><h1>空间记忆练习</h1>{finished ? <><p>{finished}</p><Link to="/history">我的记录</Link></> : current ? <Task kind="memory" mode="pointer" custom={current} done={a => {
    setCurrent(undefined)
    if (!a.complete) { setFeedback('练习被打断，可以重试或结束。'); return }
    const ok = memory(a.trials).exact === 1
    setFeedback((ok ? '正确' : '正确顺序：' + current.join(' → ')))
    setCount(count + 1); setCorrect(correct + Number(ok)); setHighest(Math.max(highest, current.length))
    if (!ok || streak === 1) { setLevel(Math.max(2, Math.min(8, level + (ok ? 1 : -1)))); setStreak(0) }
    else setStreak(1)
    if (count === 11) finish(12, correct + Number(ok), Math.max(highest, current.length))
  }} /> : <><p>已完成 {count}/12 题 · 当前序列长度 {level}</p><p role="status">{feedback}</p><div className="row"><button className="primary" onClick={() => setCurrent(sequence(level))}>开始下一题</button><button onClick={() => finish(count, correct, highest)}>结束并记录</button></div></>}</section>
}
const guidance = ['安稳坐好，保持自然呼吸。睁眼也可以。', '留意呼吸的感觉，例如空气经过鼻尖。', '如果发现走神，先觉察它。', '温和地把注意带回呼吸。', '觉察身体与座椅的接触，准备结束。']
function Mindfulness() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState('')
  function finish(seconds: number) {
    const summary = (seconds >= 300 ? '已完成' : '提前结束') + ' · 实际练习 ' + Math.floor(seconds) + ' 秒'
    const saved = save({ schemaVersion: 1, id: crypto.randomUUID(), date: new Date().toISOString(), kind: 'mindfulness', summary })
    setRunning(false); setResult(summary + (saved ? '' : ' · 尚未保存'))
  }
  useEffect(() => {
    if (!running) return
    const started = performance.now()
    const current = () => Math.min(300, elapsed + (performance.now() - started) / 1000)
    const pause = () => { setElapsed(current()); setRunning(false) }
    const visibility = () => { if (document.hidden) pause() }
    const timer = window.setInterval(() => {
      const seconds = current()
      const node = document.getElementById('mind-time')
      const text = document.getElementById('mind-text')
      if (node) node.textContent = clock(300 - seconds)
      if (text) text.textContent = guidance[Math.min(4, Math.floor(seconds / 60))]
      if (seconds >= 300) { clearInterval(timer); finish(seconds) }
    }, 100)
    document.addEventListener('visibilitychange', visibility)
    const button = document.getElementById('mind-pause')
    const end = document.getElementById('mind-end')
    const stop = () => finish(current())
    button?.addEventListener('click', pause); end?.addEventListener('click', stop)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); button?.removeEventListener('click', pause); end?.removeEventListener('click', stop) }
  }, [running, elapsed])
  return <section className="panel narrow"><h1>五分钟正念</h1>{result ? <><p>{result}</p><Link to="/history">我的记录</Link></> : <><div className="clock" id="mind-time">{clock(300 - elapsed)}</div><p id="mind-text">{guidance[Math.min(4, Math.floor(elapsed / 60))]}</p><div className="row">{running ? <><button className="primary" id="mind-pause">暂停</button><button id="mind-end">结束</button></> : <><button className="primary" onClick={() => setRunning(true)}>{elapsed ? '继续' : '开始'}</button><button onClick={() => finish(elapsed)}>结束</button></>}</div><p className="small">本练习用于注意觉察，五分钟版本的效果尚未经独立验证。</p></>}</section>
}
function clock(seconds: number) {
  const total = Math.ceil(seconds)
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0')
}
function History() {
  const [filter, setFilter] = useState('all')
  const [revision, refresh] = useState(0)
  useEffect(() => { const update = () => refresh(v => v + 1); window.addEventListener('storage', update); return () => window.removeEventListener('storage', update) }, [])
  const list = records().filter(r => 'attempts' in r ? filter !== 'training' && r.attempts.length > 0 : filter !== 'assessment')
  return <><h1>我的记录</h1><label>记录类型<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部</option><option value="assessment">测评</option><option value="training">训练</option></select></label>{storageError && <p role="status">部分记录可能无法读取或保存。</p>}{!list.length && <p>还没有记录。</p>}<div className="stack" key={revision}>{list.map(r => <section className="panel row" key={r.id}><div><h2>{'attempts' in r ? '认知测评' : r.kind === 'memory' ? '空间记忆练习' : r.kind === 'cards' ? '记忆翻牌' : '正念练习'}</h2><p>{date(r.date)}{'summary' in r && ' · ' + r.summary}</p></div>{'attempts' in r && <Link to={'/results/' + r.id}>查看详情</Link>}</section>)}</div></>
}
function About({ onClear }: { onClear: () => void }) {
  const [message, setMessage] = useState('')
  return <section className="panel narrow"><h1>关于 BrainAge</h1><p>测评记录空间记忆和注意任务的当次表现。任务参数尚未经心理测量验证，分数适合结合当日状态与原始指标阅读。</p><p>数据保存在当前浏览器。<a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11629032/" target="_blank" rel="noreferrer">查看移动认知测评研究</a></p><button onClick={() => { if (window.confirm('删除当前浏览器中的全部 BrainAge 记录？')) { const ok = clear(); if (ok) onClear(); setMessage(ok ? '已删除全部记录。' : '无法删除，请检查浏览器存储设置。') } }}>删除全部记录</button><p role="status">{message}</p></section>
}
function App() {
  const [session, setSession] = useState<Session | undefined>(() => records().find((r): r is Session => 'attempts' in r && r.status === 'active'))
  function update(s: Session) { save(s); setSession(s) }
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key?.startsWith(prefix)) cache.delete(event.key.slice(prefix.length))
      if (event.key === null) cache.clear()
      if ((event.key === null || event.key === prefix + session?.id) && event.newValue === null) setSession(undefined)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [session?.id])
  return <><header className="chrome"><div className="row shell"><Link className="brand" to="/">Brain<span>Age</span></Link><nav aria-label="主导航"><Link to="/">首页</Link><Link to="/training">练习</Link><Link to="/history">记录</Link><Link to="/about">关于</Link></nav></div></header><main className="shell"><Routes><Route path="/" element={<Home />} /><Route path="/assessment/setup" element={<Setup start={update} />} /><Route path="/assessment/run" element={<Run session={session} update={update} />} /><Route path="/results/:id" element={<Result />} /><Route path="/training" element={<TrainingMenu />} /><Route path="/training/memory" element={<MemoryTraining />} /><Route path="/training/cards" element={<MemoryCards onComplete={saveCardGame} />} /><Route path="/training/mindfulness" element={<Mindfulness />} /><Route path="/history" element={<History />} /><Route path="/about" element={<About onClear={() => setSession(undefined)} />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></main></>
}
createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>)
