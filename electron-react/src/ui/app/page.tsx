"use client"

import { useState, useEffect } from "react"
import { ImageUpload } from "../components/image-upload"
import { ProcessingPanel } from "../components/processing-panel"
import { ComparisonViewer } from "../components/comparison-viewer"
import { ExportPanel } from "../components/export-panel"
import { Card } from "../components/ui/card"
import { getApiUrl, API_CONFIG } from "../lib/api-config"

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

  useEffect(() => {
    fetchBatchesAndImages()
  }, [])

  async function fetchBatchesAndImages() {
    try {
      // Fetch all batches
      const batchesResponse = await fetch(getApiUrl('batches'))
      if (!batchesResponse.ok) {
        throw new Error(`Failed to fetch batches: ${batchesResponse.statusText}`)
      }
      const batchData: { id: number; name: string; description: string | null }[] = await batchesResponse.json()

      // Initialize batches with empty images
      const newBatches: ImageBatch[] = batchData
        .filter(batch => batch.id != null && batch.name) // Ensure valid batch data
        .map(batch => ({
          id: batch.id.toString(),
          name: batch.name,
          createdAt: new Date(), // Placeholder, as createdAt is not provided by the backend
          images: [],
          filters: [],
        }))

      setBatches(newBatches)

      // Fetch images for each batch
      const batchPromises = newBatches.map(batch => 
        batch.id ? fetchBatchImages(batch.id) : Promise.resolve()
      )
      await Promise.all(batchPromises)
    } catch (error) {
      console.error('Error fetching batches and images:', error)
      alert('Failed to load batches. Please try again.')
    }
  }

  async function fetchBatchImages(batchId: string) {
    if (!batchId) {
      console.warn('Skipping image fetch: batchId is undefined')
      return
    }

    try {
      const response = await fetch(`${getApiUrl('batches')}/${batchId}/images`)
      if (!response.ok) {
        throw new Error(`Failed to fetch images for batch ${batchId}: ${response.statusText}`)
      }
      const data: {
        batch_id: number
        batch_name: string
        original_images: {
          id: number
          file_id: string
          file_name: string
          file_type: string
          file_size: number
          url: string
        }[]
        filtered_images: {
          id: number
          filtered_file_id: string
          filtered_file_name: string
          filtered_file_type: string
          filtered_file_size: number
          status: string
          url: string
        }[]
      } = await response.json()

      const processedImages: ProcessedImage[] = data.original_images.map(orig => {
        const originalBaseName = orig.file_name.split('.')[0]
        const matchingFiltered = data.filtered_images.filter(filt =>
          filt.filtered_file_name.includes(`filtered_${originalBaseName}`) && filt.status === 'completed'
        )
        // Sort by id descending to get the latest filtered image
        matchingFiltered.sort((a, b) => b.id - a.id)
        const latestFiltered = matchingFiltered[0]

        return {
          id: orig.id.toString(),
          originalFile: null as any, // No original file available when fetched from backend
          originalUrl: `${API_CONFIG.baseUrl}${orig.url}`,
          processedUrl: latestFiltered ? `${API_CONFIG.baseUrl}${latestFiltered.url}` : undefined,
          processedBlob: undefined,
          filters: [], // Filters not provided in the backend response; assume empty or fetch separately if needed
          name: orig.file_name,
          batchId,
          fileId: orig.file_id,
          documentId: orig.id,
          fileSize: orig.file_size,
          fileType: orig.file_type,
        }
      })

      setBatches(prevBatches =>
        prevBatches.map(batch =>
          batch.id === batchId ? { ...batch, images: processedImages } : batch
        )
      )
    } catch (error) {
      console.error(`Error fetching images for batch ${batchId}:`, error)
    }
  }

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