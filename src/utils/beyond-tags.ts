/**
 * One of D&D Beyond's tags around its text, such as `[condition]Charmed[/condition]` or
 * `[spell]Fireball[/spell]`, in any letter case, its closing tag naming its opening one. Text with
 * no tag inside it, so that of tags inside one another the innermost is read first.
 */
const TAG = /\[([a-z]+)\]([^[\]]*)\[\/\1\]/gi

/**
 * A sheet's text without the tags D&D Beyond's markup leaves in it, each read as its text alone,
 * such as "Charmed" for `[condition]Charmed[/condition]`; a tag never closed, or closed by another,
 * is left as it is, as plain text. An import from D&D Beyond leaves them in a creature's traits.
 */
export function withoutTags(text: string): string {
  const read = text.replaceAll(TAG, '$2')
  return read === text ? read : withoutTags(read)
}
