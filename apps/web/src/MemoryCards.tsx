import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { boardSizes, chooseCard, flip, newGame, settle, type Columns, type Difficulty, type Game, type Player } from './cardGame'
import './memoryCards.css'

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q']
const suits = ['♥', '♣', '♦', '♠']
const suitNames = ['红桃', '梅花', '方块', '黑桃']
const difficultyNames = { easy: '简单', medium: '中等', hard: '困难' }

export function MemoryCards({ onComplete }: { onComplete: (summary: string) => boolean }) {
  const [mode, setMode] = useState<'ai' | 'local'>('ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [columns, setColumns] = useState<Columns>(4)
  const [game, setGame] = useState<Game>()
  const [saved, setSaved] = useState(true)
  const labels = mode === 'ai' ? ['你', '电脑'] : ['玩家一', '玩家二']
  const finished = game?.cards.every(card => card.taken) ?? false
  const thinking = !!game && mode === 'ai' && game.player === 1 && !finished
  const resolving = game?.open.length === 2

  useEffect(() => {
    if (!game || finished) return
    if (game.open.length === 2) {
      const timer = window.setTimeout(() => {
        const next = settle(game)
        setGame(next)
        if (next.cards.every(card => card.taken)) {
          const players = mode === 'ai' ? ['你', '电脑'] : ['玩家一', '玩家二']
          const [left, right] = next.scores
          const outcome = left === right ? '平局' : players[left > right ? 0 : 1] + '获胜'
          const format = mode === 'ai' ? '人机 · ' + difficultyNames[difficulty] : '本地双人'
          setSaved(onComplete(format + ' · 4×' + columns + ' · ' + left + ':' + right + ' · ' + outcome))
        }
      }, game.feedback === 'match' ? 550 : 1050)
      return () => window.clearTimeout(timer)
    }
    if (thinking) {
      const timer = window.setTimeout(() => {
        const index = chooseCard(game, difficulty)
        if (index !== undefined) setGame(flip(game, index))
      }, game.open.length ? 650 : 500)
      return () => window.clearTimeout(timer)
    }
  }, [game, finished, thinking, mode, difficulty, columns, onComplete])

  function start() {
    const first: Player = mode === 'ai' || Math.random() < .5 ? 0 : 1
    setSaved(true)
    setGame(newGame(columns, first))
  }

  return <section className="card-game">
    <div className="row"><Link to="/training">← 返回练习</Link>{game && <button className="quiet" onClick={() => {
      if (finished || window.confirm('结束这局并返回设置？')) setGame(undefined)
    }}>{finished ? '牌局设置' : '结束牌局'}</button>}</div>
    <h1>「神经衰弱」记忆翻牌</h1>
    {!game ? <div className="panel card-setup">
      <p>每次翻两张牌。配对成功可继续翻牌，配对失败后换手。收集对子最多的一方获胜。</p>
      <form onSubmit={event => { event.preventDefault(); start() }}>
        <label>对战模式<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="ai">人机对战</option><option value="local">本地双人</option></select></label>
        {mode === 'ai' && <label>电脑难度<select value={difficulty} onChange={event => setDifficulty(event.target.value as Difficulty)}>{Object.entries(difficultyNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>}
        <label>牌局规模<select value={columns} onChange={event => setColumns(Number(event.target.value) as Columns)}>{boardSizes.map(size => <option key={size} value={size}>4×{size} · {size * 2} 对</option>)}</select></label>
        <button className="primary">开始对局</button>
      </form>
    </div> : <>
      <div className="card-scores">{labels.map((label, player) => <div key={label} className={!finished && game.player === player ? 'current' : ''}>
        <span>{label}{!finished && game.player === player ? ' · 当前回合' : ''}</span><strong>{game.scores[player]} 对</strong>
      </div>)}</div>
      <p className="card-turn" role="status" aria-atomic="true">{finished
        ? game.scores[0] === game.scores[1] ? '平局' : labels[game.scores[0] > game.scores[1] ? 0 : 1] + '获胜'
        : resolving ? game.feedback === 'match' ? '配对成功，可以继续翻牌。' : '配对失败，即将换手。'
          : thinking ? '电脑正在翻牌…' : labels[game.player] + (game.open.length ? '，请翻第二张牌。' : '，请翻第一张牌。')}</p>
      {finished ? <div className="row"><button className="primary" onClick={start}>再来一局</button><Link to="/history">查看练习记录</Link>{!saved && <p role="alert">记录尚未保存，刷新后可能丢失。</p>}</div> :
        <div className="card-board" style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }} aria-label={'4 行 ' + columns + ' 列牌阵'}>
          {game.cards.map((card, index) => {
            const visible = game.open.includes(index)
            const suit = card.face % suits.length
            const rank = ranks[card.face]
            const position = '第 ' + (Math.floor(index / columns) + 1) + ' 行第 ' + (index % columns + 1) + ' 列'
            if (card.taken) return <span className="playing-card taken" key={index} aria-hidden="true" />
            return <button key={index} className={'playing-card ' + (visible ? 'face-up suit-' + suit : 'face-down')}
              aria-label={position + (visible ? '，' + suitNames[suit] + ' ' + rank : '，未翻开')}
              aria-disabled={thinking || resolving || visible} onClick={() => {
                if (!thinking && !resolving && !visible) setGame(previous => previous && (mode === 'local' || previous.player === 0) ? flip(previous, index) : previous)
              }}>
              {visible ? <><span>{rank}</span><strong aria-hidden="true">{suits[suit]}</strong></> : <span aria-hidden="true">✦</span>}
            </button>
          })}
        </div>}
    </>}
  </section>
}
