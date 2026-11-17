import { formatNumber } from '../format'
import type { UpgradeCurrency } from '../game/types'

// The two currencies as little icons: gold is a coin stamped with a d20, infamy a crimson skull.
// Sized by `size` (px), so they sit inline with text at any scale.

export function GoldIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={`inline-block shrink-0 ${className}`} role="img" aria-label="gold">
      <circle cx="10" cy="10" r="9" fill="#b9791c" />
      <circle cx="10" cy="9.4" r="8.4" fill="#f4bf3e" />
      <circle cx="10" cy="9.4" r="6.3" fill="#e9a92a" stroke="#c98a1f" strokeWidth="0.8" />
      {/* A d20 stamped in the middle: hexagon outline with its front triangle. */}
      <path d="M10 4.9 13.9 7.15 13.9 11.65 10 13.9 6.1 11.65 6.1 7.15Z" fill="none" stroke="#fbe08a" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M10 6.6 12.6 11 7.4 11Z" fill="#fbe08a" opacity="0.9" />
      <path d="M4.3 6.2a6.6 6.6 0 0 1 4.4-3.6" stroke="#fff6d0" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.8" />
    </svg>
  )
}

export function InfamyIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={`inline-block shrink-0 ${className}`} role="img" aria-label="infamy">
      {/* Skull: a round cranium over a squarer jaw, shadow first. */}
      <path d="M10 2.2c-4 0-7 2.9-7 6.6 0 2.1 1 3.8 2.6 4.9v2.4c0 .9.7 1.6 1.6 1.6h5.6c.9 0 1.6-.7 1.6-1.6v-2.4c1.6-1.1 2.6-2.8 2.6-4.9 0-3.7-3-6.6-7-6.6Z" fill="#7d1a2b" />
      <path d="M10 1.5c-4 0-7 2.9-7 6.6 0 2.1 1 3.8 2.6 4.9v2.4c0 .9.7 1.6 1.6 1.6h5.6c.9 0 1.6-.7 1.6-1.6V13c1.6-1.1 2.6-2.8 2.6-4.9 0-3.7-3-6.6-7-6.6Z" fill="#e2485e" />
      <ellipse cx="7.3" cy="8.6" rx="1.9" ry="2.1" fill="#2b0910" />
      <ellipse cx="12.7" cy="8.6" rx="1.9" ry="2.1" fill="#2b0910" />
      <path d="M10 10.6 11 12.4H9Z" fill="#2b0910" />
      <path d="M8.4 14.2v2.4M10 14.2v2.4M11.6 14.2v2.4" stroke="#2b0910" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M5.2 5.4a5.6 5.6 0 0 1 3.2-2.4" stroke="#ffc2cb" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.8" />
    </svg>
  )
}

export function CurrencyIcon({ currency, size }: { currency: UpgradeCurrency; size?: number }) {
  return currency === 'gold' ? <GoldIcon size={size} /> : <InfamyIcon size={size} />
}

/** An amount with its currency's icon, e.g. [coin] 1,200. */
export function Amount({ value, currency, size = 14, className = '' }: { value: number; currency: UpgradeCurrency; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <CurrencyIcon currency={currency} size={size} />
      {formatNumber(value)}
    </span>
  )
}
