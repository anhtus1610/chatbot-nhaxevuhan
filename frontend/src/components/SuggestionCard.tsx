import { LucideIcon } from 'lucide-react'

interface SuggestionCardProps {
  text: string
  icon: LucideIcon
  onClick: () => void
}

export default function SuggestionCard({ text, icon: Icon, onClick }: SuggestionCardProps) {
  return (
    <button className="suggestion-card" onClick={onClick}>
      <p>{text}</p>
      <div className="icon">
        <Icon size={18} />
      </div>
    </button>
  )
}
