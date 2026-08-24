import type { ComponentPropsWithoutRef } from 'react'

type WordmarkProps = Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'>

/**
 * The approved Marked. wordmark artwork -- the actual brand mark, not just
 * product-name text. Reserved for surfaces where "Marked." functions as a
 * visual brand mark (app header, loading screen, the bare error screen,
 * onboarding's hero moment): ordinary sentence copy and button labels that
 * happen to say "Marked." stay plain text.
 *
 * See design/wordmark-master.png / design/wordmark-dark-master.png for the
 * untouched approved sources; public/wordmark.png and public/wordmark-dark.png
 * are their tightly cropped runtime derivatives (the masters carry a lot of
 * surrounding canvas the shipped asset has no reason to pay for).
 *
 * The dark variant is selected via a <picture> source's native
 * prefers-color-scheme media match, not a JS listener: the browser resolves
 * the correct image before first paint, so there is no flash of the wrong
 * wordmark and no second theme-detection mechanism alongside the CSS media
 * query index.css already uses for every other color token.
 */
export function Wordmark(props: WordmarkProps) {
  return (
    <picture>
      <source srcSet="/wordmark-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/wordmark.png" alt="Marked." {...props} />
    </picture>
  )
}
