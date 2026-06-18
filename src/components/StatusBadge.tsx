interface StatusBadgeProps {
  status: 'available' | 'borrowed' | 'reserved' | 'overdue' | 'maintenance'
  size?: 'sm' | 'md'
}

const STATUS_MAP = {
  available:   { label: '可借用', className: 'bg-green-100 text-green-700' },
  borrowed:    { label: '借出中', className: 'bg-red-100 text-red-600' },
  reserved:    { label: '已預約', className: 'bg-amber-100 text-amber-700' },
  overdue:     { label: '逾期',   className: 'bg-orange-100 text-orange-700' },
  maintenance: { label: '維修中', className: 'bg-purple-100 text-purple-700' },
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { label, className } = STATUS_MAP[status]
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${className}`}>
      {label}
    </span>
  )
}
