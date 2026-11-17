import { useEffect, useState } from 'react'
import { useGameStore } from '../game/store'
import { BRANCHES, TREE, getNode, missingRequirements, nextRankId, nodeRank, type BranchId, type TreeNode } from '../game/data/upgradeTree'
import { getUpgradeById } from '../game/data/upgrades'
import type { DMState, Upgrade } from '../game/types'
import { Amount, CurrencyIcon } from './currency'
import { PageHeader } from './shell/Shell'
import { describeTotal } from './upgradeText'

// The upgrades as a skill tree: one lane per branch, read left to right, each node an ability
// with ranks. Pick a node to see what it does; the price on an open node buys its next rank.

const NODE_W = 190
const NODE_H = 64
const COL = 226
const ROW = 80
const PAD = 14
const LABEL_W = 148

/** Literal class names per branch (Tailwind needs them spelled out), and its colour for lines. */
const TONE: Record<BranchId, { pip: string; line: string; text: string; tile: string; ready: string; owned: string; buy: string; band: string }> = {
  table: { pip: 'bg-emerald-300', line: '#34d399', text: 'text-emerald-300', tile: 'bg-emerald-500/15', ready: 'border-emerald-400/80 shadow-[0_0_14px_-2px_rgba(52,211,153,0.55)]', owned: 'border-emerald-500/50 bg-emerald-500/10', buy: 'bg-emerald-600 hover:bg-emerald-500', band: 'bg-emerald-500/[0.04]' },
  party: { pip: 'bg-sky-300', line: '#38bdf8', text: 'text-sky-300', tile: 'bg-sky-500/15', ready: 'border-sky-400/80 shadow-[0_0_14px_-2px_rgba(56,189,248,0.55)]', owned: 'border-sky-500/50 bg-sky-500/10', buy: 'bg-sky-600 hover:bg-sky-500', band: 'bg-sky-500/[0.04]' },
  training: { pip: 'bg-violet-300', line: '#a78bfa', text: 'text-violet-300', tile: 'bg-violet-500/15', ready: 'border-violet-400/80 shadow-[0_0_14px_-2px_rgba(167,139,250,0.55)]', owned: 'border-violet-500/50 bg-violet-500/10', buy: 'bg-violet-600 hover:bg-violet-500', band: 'bg-violet-500/[0.04]' },
  notoriety: { pip: 'bg-rose-300', line: '#fb7185', text: 'text-rose-300', tile: 'bg-rose-500/15', ready: 'border-rose-400/80 shadow-[0_0_14px_-2px_rgba(251,113,133,0.55)]', owned: 'border-rose-500/50 bg-rose-500/10', buy: 'bg-rose-600 hover:bg-rose-500', band: 'bg-rose-500/[0.04]' },
  treasury: { pip: 'bg-amber-300', line: '#fbbf24', text: 'text-amber-300', tile: 'bg-amber-500/15', ready: 'border-amber-400/80 shadow-[0_0_14px_-2px_rgba(251,191,36,0.55)]', owned: 'border-amber-500/50 bg-amber-500/10', buy: 'bg-amber-600 hover:bg-amber-500', band: 'bg-amber-500/[0.04]' },
  deep: { pip: 'bg-orange-300', line: '#fb923c', text: 'text-orange-300', tile: 'bg-orange-500/15', ready: 'border-orange-400/80 shadow-[0_0_14px_-2px_rgba(251,146,60,0.55)]', owned: 'border-orange-500/50 bg-orange-500/10', buy: 'bg-orange-600 hover:bg-orange-500', band: 'bg-orange-500/[0.04]' },
  seas: { pip: 'bg-cyan-300', line: '#22d3ee', text: 'text-cyan-300', tile: 'bg-cyan-500/15', ready: 'border-cyan-400/80 shadow-[0_0_14px_-2px_rgba(34,211,238,0.55)]', owned: 'border-cyan-500/50 bg-cyan-500/10', buy: 'bg-cyan-600 hover:bg-cyan-500', band: 'bg-cyan-500/[0.04]' },
}

type NodeState = 'maxed' | 'ready' | 'open' | 'locked'

function stateOf(dm: DMState, node: TreeNode): { state: NodeState; next: Upgrade | null; rank: number } {
  const rank = nodeRank(dm, node)
  const nextId = nextRankId(dm, node)
  const next = nextId ? (getUpgradeById(nextId) ?? null) : null
  if (!next) return { state: 'maxed', next, rank }
  if (missingRequirements(dm, node).length) return { state: 'locked', next, rank }
  const balance = next.currency === 'gold' ? dm.gold : dm.infamy
  return { state: balance >= next.cost ? 'ready' : 'open', next, rank }
}

const xOf = (n: TreeNode) => n.at[0] * COL
const yOf = (n: TreeNode) => PAD + n.at[1] * ROW

function Pips({ node, rank, tone }: { node: TreeNode; rank: number; tone: string }) {
  if (node.ranks.length < 2) return null
  return (
    <span className="flex gap-0.5" aria-label={`rank ${rank} of ${node.ranks.length}`}>
      {node.ranks.map((id, i) => (
        <span key={id} className={`h-1.5 w-1.5 rounded-full ${i < rank ? tone : 'bg-slate-700'}`} />
      ))}
    </span>
  )
}

function NodeCard({ node, selected, onSelect }: { node: TreeNode; selected: boolean; onSelect: () => void }) {
  const dm = useGameStore((s) => s.dm)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const { state, next, rank } = stateOf(dm, node)
  const tone = TONE[node.branch]
  const frame =
    state === 'maxed'
      ? tone.owned
      : state === 'ready'
        ? `${tone.ready} bg-slate-900`
        : state === 'open'
          ? 'border-slate-700 bg-slate-900'
          : 'border-slate-800 bg-slate-900/50 opacity-55'
  const missing = state === 'locked' ? missingRequirements(dm, node) : []
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
      className={`absolute flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 transition hover:brightness-125 ${frame} ${selected ? 'ring-2 ring-white/70' : ''}`}
      style={{ left: xOf(node), top: yOf(node), width: NODE_W, height: NODE_H }}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl ${tone.tile} ${state === 'locked' ? 'grayscale' : ''}`}>
        {node.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-100">{node.name}</span>
        <span className="mt-1 flex h-5 items-center justify-between gap-1 text-[11px]">
          {state === 'maxed' ? (
            <span className={`flex items-center gap-1.5 ${tone.text}`}>
              ✓ {node.ranks.length > 1 ? 'Mastered' : 'Owned'}
            </span>
          ) : state === 'locked' ? (
            <span className="truncate text-slate-500">
              🔒 {missing.map((m) => `${m.node.name}${m.rank > 1 ? ` ${m.rank}` : ''}`).join(', ')}
            </span>
          ) : (
            <>
              {node.ranks.length > 1 ? <Pips node={node} rank={rank} tone={tone.pip} /> : <span className="text-slate-500">Unlock</span>}
              <button
                disabled={state !== 'ready'}
                onClick={(e) => {
                  e.stopPropagation()
                  if (next) buyUpgrade(next.id)
                }}
                title={state === 'ready' ? `Buy ${next!.name}` : 'Not enough yet'}
                className={`rounded-md px-1.5 py-0.5 font-medium text-white transition disabled:cursor-default disabled:bg-slate-800 disabled:text-slate-400 ${tone.buy}`}
              >
                <Amount value={next!.cost} currency={next!.currency} size={12} />
              </button>
            </>
          )}
        </span>
      </span>
    </div>
  )
}

/** Lines from each requirement to what it opens (lit once met; a number shows the rank needed). */
function Edges({ nodes, width, height }: { nodes: TreeNode[]; width: number; height: number }) {
  const dm = useGameStore((s) => s.dm)
  const local = (n: TreeNode) => (n.requires ?? []).filter((r) => getNode(r.node)?.branch === n.branch)
  const roots = nodes.filter((n) => local(n).length === 0)
  return (
    <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
      {roots.map((n) => {
        const y = yOf(n) + NODE_H / 2
        return <path key={n.id} d={`M -18 ${y} H ${xOf(n)}`} stroke={TONE[n.branch].line} strokeOpacity={0.5} strokeWidth={2} fill="none" />
      })}
      {nodes.flatMap((n) =>
        local(n).map((r) => {
          const from = getNode(r.node)!
          const met = nodeRank(dm, from) >= r.rank
          const x1 = xOf(from) + NODE_W
          const y1 = yOf(from) + NODE_H / 2
          const x2 = xOf(n)
          const y2 = yOf(n) + NODE_H / 2
          const dx = (x2 - x1) / 2
          return (
            <g key={`${r.node}-${n.id}`}>
              <path
                d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                stroke={met ? TONE[n.branch].line : '#334155'}
                strokeOpacity={met ? 0.75 : 1}
                strokeWidth={2}
                strokeDasharray={met ? undefined : '4 4'}
                fill="none"
              />
              {r.rank > 1 && (
                <g transform={`translate(${x2 - 13} ${y2})`}>
                  <circle r={7} fill={met ? TONE[n.branch].line : '#1e293b'} stroke="#0f172a" strokeWidth={1.5} />
                  <text textAnchor="middle" dy="3.5" fontSize="9" fontWeight="700" fill={met ? '#0f172a' : '#94a3b8'}>
                    {r.rank}
                  </text>
                </g>
              )}
            </g>
          )
        }),
      )}
    </svg>
  )
}

function Lane({ branch, selected, onSelect }: { branch: (typeof BRANCHES)[number]; selected: string | null; onSelect: (id: string) => void }) {
  const dm = useGameStore((s) => s.dm)
  const nodes = TREE.filter((n) => n.branch === branch.id)
  const cols = Math.max(...TREE.map((n) => n.at[0])) + 1
  const rows = Math.max(...nodes.map((n) => n.at[1])) + 1
  const width = (cols - 1) * COL + NODE_W
  const height = PAD * 2 + (rows - 1) * ROW + NODE_H
  const owned = nodes.reduce((s, n) => s + nodeRank(dm, n), 0)
  const total = nodes.reduce((s, n) => s + n.ranks.length, 0)
  const tone = TONE[branch.id]
  return (
    <div className={`flex border-t border-slate-800/80 first:border-t-0 ${tone.band}`}>
      <div className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-slate-800/80 bg-slate-950/90 px-3 backdrop-blur" style={{ width: LABEL_W }}>
        <div className={`text-sm font-semibold ${tone.text}`}>
          <span aria-hidden>{branch.icon}</span> {branch.name}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{branch.blurb}</div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800" title={`${owned} of ${total} ranks`}>
          <div className="h-full rounded-full" style={{ width: `${(owned / total) * 100}%`, background: tone.line }} />
        </div>
        <div className="mt-1 text-[10px] tabular-nums text-slate-500">
          {owned}/{total} ranks
        </div>
      </div>
      <div className="relative ml-6 mr-4 shrink-0" style={{ width, height }}>
        <Edges nodes={nodes} width={width} height={height} />
        {nodes.map((n) => (
          <NodeCard key={n.id} node={n} selected={selected === n.id} onSelect={() => onSelect(n.id)} />
        ))}
      </div>
    </div>
  )
}

/** The picked node: what its ranks add up to now and after the next, what it needs, and buying it. */
function Details({ id, onClose }: { id: string | null; onClose: () => void }) {
  const dm = useGameStore((s) => s.dm)
  const buyUpgrade = useGameStore((s) => s.buyUpgrade)
  const node = id ? getNode(id) : undefined
  if (!node)
    return (
      <div className="text-sm text-slate-400">
        Pick an upgrade to see what it does. <span className="text-slate-500">Glowing ones you can buy now; their price buys them in one click.</span>
      </div>
    )
  const { state, next, rank } = stateOf(dm, node)
  const branch = BRANCHES.find((b) => b.id === node.branch)!
  const ownedUps = node.ranks.slice(0, rank).map((r) => getUpgradeById(r)!)
  const missing = missingRequirements(dm, node)
  const tone = TONE[node.branch]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl ${tone.tile}`}>{node.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-slate-100">{next?.name ?? node.name}</span>
          <span className={`text-xs ${tone.text}`}>
            {branch.name} · rank {rank}/{node.ranks.length}
          </span>
        </div>
        <p className="text-sm text-slate-300">{next ? next.description : getUpgradeById(node.ranks[node.ranks.length - 1])!.description}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Now: <span className="text-slate-300">{describeTotal(ownedUps)}</span>
          {next && (
            <>
              {' '}
              → after this: <span className={tone.text}>{describeTotal([...ownedUps, next])}</span>
            </>
          )}
          {missing.length > 0 && (
            <span className="text-amber-400/90">
              {' '}
              · needs {missing.map((m) => `${m.node.name}${m.rank > 1 ? ` rank ${m.rank}` : ''}`).join(' and ')}
            </span>
          )}
        </p>
      </div>
      {next ? (
        <button
          disabled={state !== 'ready'}
          onClick={() => buyUpgrade(next.id)}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400 ${tone.buy}`}
        >
          {state === 'locked' ? '🔒 Locked' : 'Buy'} <Amount value={next.cost} currency={next.currency} size={15} />
        </button>
      ) : (
        <span className={`shrink-0 text-sm font-medium ${tone.text}`}>✓ Mastered</span>
      )}
      <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-slate-300" aria-label="Close">
        ✕
      </button>
    </div>
  )
}

export function UpgradesPanel() {
  const dm = useGameStore((s) => s.dm)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const owned = TREE.reduce((s, n) => s + nodeRank(dm, n), 0)
  const total = TREE.reduce((s, n) => s + n.ranks.length, 0)
  const ready = TREE.filter((n) => stateOf(dm, n).state === 'ready').length
  return (
    <div>
      <PageHeader>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            {owned}/{total} ranks bought
          </span>
          {ready > 0 && <span className="text-emerald-400">{ready} you can afford now</span>}
          <span className="flex items-center gap-1">
            Paid in <CurrencyIcon currency="gold" size={13} /> gold and <CurrencyIcon currency="infamy" size={13} /> infamy
          </span>
        </p>
      </PageHeader>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
        <div className="w-max min-w-full">
          {BRANCHES.map((b) => (
            <Lane key={b.id} branch={b} selected={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} />
          ))}
        </div>
      </div>
      <div className="sticky bottom-3 z-10 mt-4 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur">
        <Details id={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}
