import { sortTags } from '../sorting'

/** An item's tags as plain labels, in natural order. Renders nothing when there are none. */
export default function TagList({ tags, className = '' }: { tags: string[] | undefined; className?: string }) {
  if (!tags || tags.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {sortTags(tags).map(tag => (
        <span key={tag} className="bg-slate-700 rounded-full px-2 py-0.5 text-xs text-slate-300">{tag}</span>
      ))}
    </div>
  )
}
