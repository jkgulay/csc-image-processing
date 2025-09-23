"use client"

import { useState } from "react"
import { ImageUpload } from "../components/image-upload"
import { ProcessingPanel } from "../components/processing-panel"
import { ComparisonViewer } from "../components/comparison-viewer"
import { ExportPanel } from "../components/export-panel"
import { Card } from "../components/ui/card"

export interface ProcessedImage {
  id: string
  originalFile: File
  originalUrl: string
  processedUrl?: string
  processedBlob?: Blob
  filters: string[]
  name: string
  batchId: string 
  fileId?: string
  documentId?: number
  fileSize?: number
  fileType?: string
}

export interface ImageBatch {
  id: string
  name: string
  createdAt: Date
  images: ProcessedImage[]
  filters: string[] 
}

export default function ImageProcessorPage() {
  const [batches, setBatches] = useState<ImageBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId)
  const selectedImage = selectedBatch?.images.find((img) => img.id === selectedImageId)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Image Processor</h1>
          <p className="text-muted-foreground text-lg">
            Create batches, upload images, and apply transformations with advanced processing tools
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload and Batch Management */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <ImageUpload
                batches={batches}
                setBatches={setBatches}
                selectedBatchId={selectedBatchId}
                setSelectedBatchId={setSelectedBatchId}
                selectedImageId={selectedImageId}
                setSelectedImageId={setSelectedImageId}
              />
            </Card>
          </div>

          {/* Processing Panel */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <ProcessingPanel
                batches={batches}
                setBatches={setBatches}
                selectedBatchId={selectedBatchId}
                selectedImageId={selectedImageId}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
              />
            </Card>
          </div>

          {/* Export Panel */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <ExportPanel batches={batches} selectedBatch={selectedBatch} selectedImage={selectedImage} />
            </Card>
          </div>
        </div>

        {/* Comparison Viewer */}
        {selectedImage && (
          <div className="mt-6">
            <Card className="p-6">
              <ComparisonViewer selectedImage={selectedImage} />
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
