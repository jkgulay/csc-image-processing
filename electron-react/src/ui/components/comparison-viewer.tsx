"use client"

import { useState } from "react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Eye, EyeOff, ZoomIn, ZoomOut } from "lucide-react"
import type { ProcessedImage } from "../app/page"

interface ComparisonViewerProps {
  selectedImage: ProcessedImage
}

export function ComparisonViewer({ selectedImage }: ComparisonViewerProps) {
  const [showOriginal, setShowOriginal] = useState(true)
  const [showProcessed, setShowProcessed] = useState(true)
  const [zoom, setZoom] = useState(100)

  const hasProcessedVersion = selectedImage.processedUrl && selectedImage.filters.length > 0

  const resetZoom = () => setZoom(100)
  const zoomIn = () => setZoom((prev) => Math.min(prev + 25, 200))
  const zoomOut = () => setZoom((prev) => Math.max(prev - 25, 25))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Side-by-Side Comparison</h3>
          {hasProcessedVersion && <Badge variant="secondary">{selectedImage.filters.length} filters applied</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut} disabled={zoom <= 25}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetZoom}>
            {zoom}%
          </Button>
          <Button variant="outline" size="sm" onClick={zoomIn} disabled={zoom >= 200}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!hasProcessedVersion ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2">No processed version available</p>
          <p className="text-sm text-muted-foreground">Apply filters to see the comparison</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Image */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Original</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowOriginal(!showOriginal)} className="h-8 px-2">
                {showOriginal ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
            <Card className="p-4 bg-muted/20">
              <div className="relative overflow-hidden rounded-lg bg-background">
                {showOriginal && (
                  <img
                    src={selectedImage.originalUrl || "/placeholder.svg"}
                    alt="Original"
                    className="w-full h-auto transition-transform duration-200"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                  />
                )}
                {!showOriginal && (
                  <div className="aspect-video flex items-center justify-center bg-muted">
                    <EyeOff className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>
            <div className="text-xs text-muted-foreground">
              <p>File: {selectedImage.name}</p>
              <p>Size: {(selectedImage.originalFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>

          {/* Processed Image */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Processed</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowProcessed(!showProcessed)} className="h-8 px-2">
                {showProcessed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
            <Card className="p-4 bg-muted/20">
              <div className="relative overflow-hidden rounded-lg bg-background">
                {showProcessed && selectedImage.processedUrl && (
                  <img
                    src={selectedImage.processedUrl || "/placeholder.svg"}
                    alt="Processed"
                    className="w-full h-auto transition-transform duration-200"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                  />
                )}
                {!showProcessed && (
                  <div className="aspect-video flex items-center justify-center bg-muted">
                    <EyeOff className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>
            <div className="text-xs text-muted-foreground">
              <p>Filters: {selectedImage.filters.join(", ")}</p>
              <p>
                Size:{" "}
                {selectedImage.processedBlob
                  ? (selectedImage.processedBlob.size / 1024 / 1024).toFixed(2)
                  : "Calculating..."}{" "}
                MB
              </p>
            </div>
          </div>
        </div>
      )}

      {hasProcessedVersion && (
        <>
          <Separator />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{selectedImage.filters.length}</p>
              <p className="text-xs text-muted-foreground">Filters Applied</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{zoom}%</p>
              <p className="text-xs text-muted-foreground">Zoom Level</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {selectedImage.processedBlob
                  ? Math.round(
                      ((selectedImage.originalFile.size - selectedImage.processedBlob.size) /
                        selectedImage.originalFile.size) *
                        100,
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-muted-foreground">Size Change</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-muted-foreground">Last Processed</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
