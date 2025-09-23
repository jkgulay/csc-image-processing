"use client"

import { useState } from "react"
import { Card } from "./card"
import { Button } from "./button"
import { Badge } from "./badge"
import { Eye, Download, Trash2 } from "lucide-react"
import { cn } from "../../lib/utils"

interface ImageGridItem {
  id: string
  src: string
  alt: string
  title: string
  subtitle?: string
  badges?: string[]
  isSelected?: boolean
}

interface ImageGridProps {
  images: ImageGridItem[]
  onSelect?: (id: string) => void
  onPreview?: (id: string) => void
  onDownload?: (id: string) => void
  onDelete?: (id: string) => void
  columns?: 2 | 3 | 4 | 6
  className?: string
}

export function ImageGrid({
  images,
  onSelect,
  onPreview,
  onDownload,
  onDelete,
  columns = 3,
  className,
}: ImageGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    6: "grid-cols-6",
  }

  return (
    <div className={cn(`grid gap-4 ${gridCols[columns]}`, className)}>
      {images.map((image) => (
        <Card
          key={image.id}
          className={cn(
            "group relative overflow-hidden cursor-pointer transition-all duration-200",
            image.isSelected && "ring-2 ring-primary",
            "hover:shadow-md",
          )}
          onClick={() => onSelect?.(image.id)}
          onMouseEnter={() => setHoveredId(image.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="aspect-square relative">
            <img src={image.src || "/placeholder.svg"} alt={image.alt} className="w-full h-full object-cover" />

            {/* Overlay Controls */}
            {hoveredId === image.id && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onPreview && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreview(image.id)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {onDownload && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload(image.id)
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(image.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-sm truncate">{image.title}</h4>
              {image.isSelected && (
                <Badge variant="default" className="text-xs">
                  Selected
                </Badge>
              )}
            </div>
            {image.subtitle && <p className="text-xs text-muted-foreground truncate mb-2">{image.subtitle}</p>}
            {image.badges && image.badges.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {image.badges.slice(0, 2).map((badge, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                ))}
                {image.badges.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{image.badges.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
