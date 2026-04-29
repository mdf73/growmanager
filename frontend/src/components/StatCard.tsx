import React from 'react'
import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'green' | 'blue' | 'purple' | 'orange'
  subtitle?: string
}

const colorClasses = {
  green: 'bg-grow-50 text-grow-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
}

const iconBgClasses = {
  green: 'bg-grow-200',
  blue: 'bg-blue-200',
  purple: 'bg-purple-200',
  orange: 'bg-orange-200',
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = 'green',
  subtitle,
}: StatCardProps) {
  return (
    <div className={clsx('rounded-lg p-6', colorClasses[color])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-lg', iconBgClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}
