"use client"

import { Badge } from "./badge"
import { Button } from "./button"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

interface FilterBadgeProps {
  label: string
  value?: string | number
  onRemove?: () => void
  variant?: "default" | "secondary" | "destructive" | "outline"
  className?: string
}

export function FilterBadge({ label, value, onRemove, variant = "secondary", className }: FilterBadgeProps) {
  return (
    <Badge variant={variant} className={cn("flex items-center gap-1 pr-1", className)}>
      <span>{label}</span>
      {value !== undefined && <span className="text-xs opacity-75">({value})</span>}
      {onRemove && (
        <Button variant="ghost" size="sm" className="h-3 w-3 p-0 hover:bg-transparent" onClick={onRemove}>
          <X className="h-2 w-2" />
        </Button>
      )}
    </Badge>
  )
}
