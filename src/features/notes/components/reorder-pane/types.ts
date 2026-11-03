import type {
  NoteBookKind,
  NoteEntryView,
  NoteWriteAnswer,
} from '@/types/notes'

export type ReorderPaneProps = {
  /** The group's title: its chapter's, or "Not in a chapter". */
  title: string
  /**
   * The group's notes in their order as Reorder opened: the pane keeps its own list from them,
   * which a later poll changes only by dropping a note gone from the view (as ART:1128-1129
   * filters); a note added meanwhile isn't in it.
   */
  entries: NoteEntryView[]
  kind: NoteBookKind
  /** The book's character or party. */
  name: string
  /** Sends the new order; answers as the write did. */
  onSave(ids: string[]): Promise<NoteWriteAnswer>
  onCancel(): void
}
