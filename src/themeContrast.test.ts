// TypeScript 6 no longer auto-includes @types/*, and src's tsconfig only
// references vite/client -- so this one file asks for Node's types itself,
// rather than widening them to every file under src.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two user-protection invariants (STANDARD.md §20.3) that no component test
 * can see, because jsdom does not render CSS: text drawn on a ledger color
 * stays readable (§13), and a text field's crisp focus edge is perceivable
 * on its own (§8.2 -- 3:1 against what it touches; the soft --halo bloom
 * does not count). Every value is read from the real stylesheets, so
 * editing a color in index.css fails here rather than going unnoticed.
 *
 * Read from disk rather than imported with `?raw`: Vitest replaces plain CSS
 * with an empty string by default, and turning CSS processing on for the
 * whole suite would be a far bigger change than this guard is worth.
 */
const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const tokensCss = readFileSync(
  resolve(process.cwd(), 'node_modules/@maker428/ui/dist/styles/tokens.css'),
  'utf8',
)

type Rgb = [number, number, number]
type Theme = 'light' | 'dark'

function hex(value: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb
}

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((v, i) => v * alpha + bottom[i] * (1 - alpha)) as Rgb
}

/** The first `--name: #rrggbb` declaration of each name, in source order. */
function declaredHex(css: string): Map<string, Rgb> {
  const found = new Map<string, Rgb>()
  for (const [, name, value] of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    if (!found.has(name)) found.set(name, hex(value))
  }
  return found
}

// @maker428/ui keeps its dark values under `--m428-dark-color-*`; the light
// ones under the public `--color-*` names themselves.
const packageLight = declaredHex(tokensCss)
const packageDark = new Map<string, Rgb>(
  [...declaredHex(tokensCss)]
    .filter(([name]) => name.startsWith('--m428-dark-color-'))
    .map(([name, value]) => [name.replace('--m428-dark-', '--'), value]),
)

// index.css declares each ledger color once for light and once more inside
// its single dark media block, so splitting at that block separates them.
const [indexLight, indexDark] = indexCss.split('@media (prefers-color-scheme: dark)')

const sources: Record<Theme, { index: string; tokens: Map<string, Rgb> }> = {
  light: { index: indexLight, tokens: packageLight },
  dark: { index: indexDark, tokens: new Map([...packageLight, ...packageDark]) },
}

const LEDGER_COLORS = ['clay', 'moss', 'dust', 'plum', 'rose', 'straw'] as const

function token(theme: Theme, name: string): Rgb {
  const value = sources[theme].tokens.get(name)
  if (!value) throw new Error(`${name} not found for ${theme}`)
  return value
}

function ledgerColor(theme: Theme, id: (typeof LEDGER_COLORS)[number] | 'espresso'): Rgb {
  // Espresso is a live alias of the accent itself, not a separate value.
  if (id === 'espresso') return token(theme, '--color-accent')
  const match = sources[theme].index.match(new RegExp(`--ledger-color-${id}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`--ledger-color-${id} not found for ${theme}`)
  return hex(match[1])
}

/** Resolves `color-mix(in srgb, var(--a) N%, var(--b))`, the only shape the focus edge uses. */
function focusEdge(theme: Theme): Rgb {
  const match = sources[theme].index.match(
    /--color-focus-edge:\s*color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*(\d+)%,\s*var\((--[\w-]+)\)\)/,
  )
  if (!match) throw new Error(`--color-focus-edge not found for ${theme}`)
  return over(token(theme, match[1]), Number(match[2]) / 100, token(theme, match[3]))
}

describe('text on a ledger color', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const id of ['espresso', ...LEDGER_COLORS] as const) {
      it(`${id} in ${theme}: --color-accent-text holds 4.5:1 on the fill`, () => {
        expect(contrast(token(theme, '--color-accent-text'), ledgerColor(theme, id))).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('the text-field focus edge', () => {
  // --color-well in @maker428/ui's glow.css: the shadow tone at 6% (light)
  // or 35% (dark) over whatever the field sits on.
  const wellAlpha: Record<Theme, number> = { light: 0.06, dark: 0.35 }
  const shadow: Rgb = [34, 24, 15]

  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['--color-bg', '--color-raised'] as const) {
      it(`holds 3:1 in ${theme} against the page or sheet (${surface}) and the well inside it`, () => {
        const ground = token(theme, surface)
        const well = over(shadow, wellAlpha[theme], ground)
        const edge = focusEdge(theme)
        expect(contrast(edge, ground)).toBeGreaterThanOrEqual(3)
        expect(contrast(edge, well)).toBeGreaterThanOrEqual(3)
      })
    }
  }
})
