"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Slider } from "../components/ui/slider"
import { Label } from "../components/ui/label"
import { ScrollArea } from "../components/ui/scroll-area"
import { Separator } from "../components/ui/separator"
import { Progress } from "../components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Settings, Palette, Contrast, Sun, Zap, Beer as Blur, Sparkles, Eye, Loader2, Layers } from "lucide-react"
import type { ProcessedImage, ImageBatch } from "../app/page"

interface ProcessingPanelProps {
  batches: ImageBatch[]
  setBatches: (batches: ImageBatch[]) => void
  selectedBatchId: string | null
  selectedImageId: string | null
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

interface FilterConfig {
  name: string
  icon: React.ReactNode
  type: "basic" | "advanced" | "detection"
  description: string
  key: string
}

const FILTERS: FilterConfig[] = [
  {
    name: "Brightness",
    icon: <Sun className="h-4 w-4" />,
    type: "basic",
    description: "Adjust image brightness",
    key: "brightness",
  },
  {
    name: "Contrast",
    icon: <Contrast className="h-4 w-4" />,
    type: "basic",
    description: "Enhance contrast levels",
    key: "contrast",
  },
  {
    name: "Saturation",
    icon: <Palette className="h-4 w-4" />,
    type: "basic",
    description: "Modify color saturation",
    key: "saturation",
  },
  { name: "Blur", icon: <Blur className="h-4 w-4" />, type: "basic", description: "Apply gaussian blur", key: "blur" },
  {
    name: "Sharpen",
    icon: <Zap className="h-4 w-4" />,
    type: "advanced",
    description: "Enhance image sharpness",
    key: "sharpen",
  },
  {
    name: "Vintage",
    icon: <Sparkles className="h-4 w-4" />,
    type: "advanced",
    description: "Apply vintage effect",
    key: "vintage",
  },
  {
    name: "Edge Detection",
    icon: <Eye className="h-4 w-4" />,
    type: "detection",
    description: "Detect edges in image",
    key: "edgeDetection",
  },
  {
    name: "Face Detection",
    icon: <Eye className="h-4 w-4" />,
    type: "detection",
    description: "Identify faces",
    key: "faceDetection",
  },
]

export function ProcessingPanel({
  batches,
  setBatches,
  selectedBatchId,
  selectedImageId,
  isProcessing,
  setIsProcessing,
}: ProcessingPanelProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [filterIntensity, setFilterIntensity] = useState<Record<string, number>>({})
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingMode, setProcessingMode] = useState<"single" | "batch">("single")

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId)
  const selectedImage = selectedBatch?.images.find((img) => img.id === selectedImageId)

  const toggleFilter = (filterName: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterName) ? prev.filter((f) => f !== filterName) : [...prev, filterName],
    )
  }

  const applySingleImageFilters = async () => {
    if (!selectedImage || activeFilters.length === 0 || !selectedBatch) return

    if (!selectedImage.documentId) {
      console.error("No document ID available for this image")
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      // Build filter options for API request
      const filters: any = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 50,
        sharpen: false,
        vintage: false,
        edgeDetection: false,
        faceDetection: false
      }

      // Apply active filters with their intensities
      activeFilters.forEach((filterName) => {
        const filter = FILTERS.find((f) => f.name === filterName)
        if (filter) {
          if (filter.type === "basic") {
            const intensity = filterIntensity[filterName] || 50
            if (filter.key === "brightness" || filter.key === "contrast" || filter.key === "saturation") {
              filters[filter.key] = intensity
            } else if (filter.key === "blur") {
              filters[filter.key] = intensity
            }
          } else {
            // Boolean filters
            if (filter.key === "sharpen" || filter.key === "vintage" || filter.key === "edgeDetection" || filter.key === "faceDetection") {
              filters[filter.key] = true
            }
          }
        }
      })

      const requestBody = {
        filters,
        output_format: "png"
      }

      setProcessingProgress(30)

      const response = await fetch(`http://127.0.0.1:8000/batches/${selectedBatch.id}/documents/${selectedImage.documentId}/apply-filters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setProcessingProgress(80)

      // Update the image with the processed data
      const processedUrl = `http://127.0.0.1:8000${result.url}`
      const updatedImage = {
        ...selectedImage,
        processedUrl,
        filters: activeFilters,
        fileId: result.filtered_image.filtered_file_id // Update fileId for downloads
      }

      setProcessingProgress(100)

      setBatches(
        batches.map((batch) =>
          batch.id === selectedBatchId
            ? {
                ...batch,
                images: batch.images.map((img) =>
                  img.id === selectedImageId ? updatedImage : img,
                ),
              }
            : batch,
        ),
      )

      setTimeout(() => setProcessingProgress(0), 1000)
    } catch (error) {
      console.error("Processing failed:", error)
      setProcessingProgress(0)
    } finally {
      setIsProcessing(false)
    }
  }

  const applyBatchFilters = async () => {
    if (!selectedBatch || activeFilters.length === 0 || selectedBatch.images.length === 0) return

    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      // Build filter options for API request
      const filters: any = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 50,
        sharpen: false,
        vintage: false,
        edgeDetection: false,
        faceDetection: false
      }

      // Apply active filters with their intensities
      activeFilters.forEach((filterName) => {
        const filter = FILTERS.find((f) => f.name === filterName)
        if (filter) {
          if (filter.type === "basic") {
            const intensity = filterIntensity[filterName] || 50
            if (filter.key === "brightness" || filter.key === "contrast" || filter.key === "saturation") {
              filters[filter.key] = intensity
            } else if (filter.key === "blur") {
              filters[filter.key] = intensity
            }
          } else {
            // Boolean filters
            if (filter.key === "sharpen" || filter.key === "vintage" || filter.key === "edgeDetection" || filter.key === "faceDetection") {
              filters[filter.key] = true
            }
          }
        }
      })

      const requestBody = {
        filters,
        output_format: "png"
      }

      setProcessingProgress(30)

      const response = await fetch(`http://127.0.0.1:8000/batches/${selectedBatch.id}/apply-filters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setProcessingProgress(80)

      // Update all images in the batch with processed data
      const updatedImages = selectedBatch.images.map((image) => {
        const processedItem = result.items.find((item: any) => item.document_id === image.documentId)
        if (processedItem && processedItem.status === 'ok') {
          return {
            ...image,
            processedUrl: `http://127.0.0.1:8000${processedItem.url}`,
            filters: activeFilters,
            fileId: processedItem.filtered_image.filtered_file_id // Update fileId for downloads
          }
        }
        return image
      })

      setProcessingProgress(100)

      setBatches(
        batches.map((batch) =>
          batch.id === selectedBatchId 
            ? { ...batch, images: updatedImages, filters: activeFilters } 
            : batch,
        ),
      )

      setTimeout(() => setProcessingProgress(0), 1000)
    } catch (error) {
      console.error("Batch processing failed:", error)
      setProcessingProgress(0)
    } finally {
      setIsProcessing(false)
    }
  }

  const clearFilters = () => {
    setActiveFilters([])
    setFilterIntensity({})

    if (processingMode === "single" && selectedImage) {
      setBatches(
        batches.map((batch) =>
          batch.id === selectedBatchId
            ? {
                ...batch,
                images: batch.images.map((img) =>
                  img.id === selectedImageId
                    ? { ...img, processedUrl: undefined, filters: [] }
                    : img,
                ),
              }
            : batch,
        ),
      )
    } else if (processingMode === "batch" && selectedBatch) {
      setBatches(
        batches.map((batch) =>
          batch.id === selectedBatchId
            ? {
                ...batch,
                images: batch.images.map((img) => ({
                  ...img,
                  processedUrl: undefined,
                  filters: [],
                })),
                filters: [],
              }
            : batch,
        ),
      )
    }
  }

  const filtersByType = FILTERS.reduce(
    (acc, filter) => {
      if (!acc[filter.type]) acc[filter.type] = []
      acc[filter.type].push(filter)
      return acc
    },
    {} as Record<string, FilterConfig[]>,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Processing Tools</h3>
        {activeFilters.length > 0 && <Badge variant="secondary">{activeFilters.length} active</Badge>}
      </div>

      {!selectedBatch ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Select a batch to start processing</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Tabs value={processingMode} onValueChange={(value) => setProcessingMode(value as "single" | "batch")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Single Image
              </TabsTrigger>
              <TabsTrigger value="batch" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Batch Processing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              {!selectedImage ? (
                <Card className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Select an image from the batch to process individually
                  </p>
                </Card>
              ) : (
                <Card className="p-3">
                  <p className="text-sm font-medium">Processing: {selectedImage.name}</p>
                  <p className="text-xs text-muted-foreground">Apply filters to this image only</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="batch" className="space-y-4">
              <Card className="p-3">
                <p className="text-sm font-medium">Batch: {selectedBatch.name}</p>
                <p className="text-xs text-muted-foreground">
                  Apply filters to all {selectedBatch.images.length} images in this batch
                </p>
              </Card>
            </TabsContent>
          </Tabs>

          <ScrollArea className="h-80">
            <div className="space-y-6">
              {Object.entries(filtersByType).map(([type, filters]) => (
                <div key={type}>
                  <h4 className="text-sm font-medium mb-3 capitalize">{type} Filters</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {filters.map((filter) => (
                      <Card
                        key={filter.name}
                        className={`p-3 cursor-pointer transition-colors ${
                          activeFilters.includes(filter.name) ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent"
                        }`}
                        onClick={() => toggleFilter(filter.name)}
                      >
                        <div className="flex items-center gap-3">
                          {filter.icon}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{filter.name}</p>
                            <p className="text-xs text-muted-foreground">{filter.description}</p>
                          </div>
                        </div>

                        {activeFilters.includes(filter.name) && filter.type === "basic" && (
                          <div className="mt-3 space-y-2">
                            <Label className="text-xs">Intensity</Label>
                            <Slider
                              value={[filterIntensity[filter.name] || 50]}
                              onValueChange={(value) =>
                                setFilterIntensity((prev) => ({
                                  ...prev,
                                  [filter.name]: value[0],
                                }))
                              }
                              max={100}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                  {type !== "detection" && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {processingMode === "batch"
                    ? `Processing batch (${selectedBatch.images.length} images)...`
                    : "Processing..."}
                </span>
                <span>{Math.round(processingProgress)}%</span>
              </div>
              <Progress value={processingProgress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={processingMode === "single" ? applySingleImageFilters : applyBatchFilters}
              disabled={
                activeFilters.length === 0 ||
                isProcessing ||
                (processingMode === "single" && !selectedImage) ||
                (processingMode === "batch" && selectedBatch.images.length === 0)
              }
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Apply to ${processingMode === "single" ? "Image" : "Batch"}`
              )}
            </Button>
            <Button variant="outline" onClick={clearFilters} disabled={activeFilters.length === 0}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
