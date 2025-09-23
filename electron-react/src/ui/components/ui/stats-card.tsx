import { Card } from "./card"
import { Badge } from "./badge"
import { cn } from "../../lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  badge?: string
  className?: string
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, trendValue, badge, className }: StatsCardProps) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-muted-foreground",
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {badge && (
              <Badge variant="secondary" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        {trend && trendValue && (
          <div className={cn("text-right", trendColors[trend])}>
            <p className="text-sm font-medium">{trendValue}</p>
            <p className="text-xs capitalize">{trend}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
