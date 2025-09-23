"use client"

import { useState } from "react"
import { Card } from "./card"
import { Button } from "./button"
import { Badge } from "./badge"
import { ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from "lucide-react"
import { cn } from "../../lib/utils"

interface ImagePreviewProps {
  src: string
  alt: string
  title?: string
  subtitle?: string
  badges?: string[]
  onDownload?: () => void
  className?: string
}

export function ImagePreview({ src, alt, title, subtitle, badges = [], onDownload, className }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const zoomIn = () => setZoom((prev) => Math.min(prev + 25, 300))
  const zoomOut = () => setZoom((prev) => Math.max(prev - 25, 25))
  const rotate = () => setRotation((prev) => (prev + 90) % 360)
  const resetView = () => {
    setZoom(100)
    setRotation(0)
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || subtitle || badges.length > 0) && (
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              {title && <h3 className="font-semibold">{title}</h3>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex gap-1">
              {badges.map((badge, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative bg-muted/20">
        <div className="overflow-hidden">
          <img
            src={src || "/placeholder.svg"}
            alt={alt}
            className="w-full h-auto transition-all duration-200"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: "center",
            }}
          />
        </div>

        {/* Controls Overlay */}
        <div className="absolute top-2 right-2 flex gap-1">
          <Button variant="secondary" size="sm" onClick={zoomOut} disabled={zoom <= 25}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button variant="secondary" size="sm" onClick={resetView}>
            {zoom}%
          </Button>
          <Button variant="secondary" size="sm" onClick={zoomIn} disabled={zoom >= 300}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button variant="secondary" size="sm" onClick={rotate}>
            <RotateCw className="h-3 w-3" />
          </Button>
          {onDownload && (
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download className="h-3 w-3" />
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
