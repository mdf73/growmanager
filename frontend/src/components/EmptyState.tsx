import React from 'react'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description?: string
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Icon size={48} className="text-grow-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center">{description}</p>}
    </div>
  )
}
