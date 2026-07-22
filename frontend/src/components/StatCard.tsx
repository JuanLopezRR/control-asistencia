import type { ReactNode } from 'react'

export default function StatCard({
  icon,
  label,
  value,
  sub,
  color = 'zinc',
}: {
  icon: ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  const colors: Record<string, string> = {
    zinc: 'bg-zinc-50 text-zinc-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 flex items-start gap-4 transition-shadow hover:shadow-sm">
      <div className={`p-2.5 rounded-lg ${colors[color] || colors.zinc}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-semibold text-zinc-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
