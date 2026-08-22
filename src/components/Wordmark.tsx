import type { ComponentPropsWithoutRef } from 'react'

type WordmarkProps = Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'>

/**
 * The approved Marked. wordmark artwork -- the actual brand mark, not just
 * product-name text. Reserved for surfaces where "Marked." functions as a
 * visual brand mark (app header, loading screen, the bare error screen,
 * onboarding's hero moment): ordinary sentence copy and button labels that
 * happen to say "Marked." stay plain text.
 *
 * See design/wordmark-master.png for the untouched approved source;
 * public/wordmark.png is its tightly cropped runtime derivative (the master
 * carries a lot of surrounding canvas the shipped asset has no reason to
 * pay for).
 */
export function Wordmark(props: WordmarkProps) {
  return <img src="/wordmark.png" alt="Marked." {...props} />
}
