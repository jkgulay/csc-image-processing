"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Progress } from "../components/ui/progress"
import { Upload, X, ImageIcon, Plus, FolderPlus, Folder, Loader2 } from "lucide-react"
import type { ProcessedImage, ImageBatch } from "../app/page"
import { getApiUrl, API_CONFIG, type BatchCreateRequest, type BatchCreateResponse, type FileUploadResponse } from "../lib/api-config"

interface ImageUploadProps {
  batches: ImageBatch[]
  setBatches: (batches: ImageBatch[]) => void
  selectedBatchId: string | null
  setSelectedBatchId: (id: string | null) => void
  selectedImageId: string | null
  setSelectedImageId: (id: string | null) => void
}

export function ImageUpload({
  batches,
  setBatches,
  selectedBatchId,
  setSelectedBatchId,
  selectedImageId,
  setSelectedImageId,
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [newBatchName, setNewBatchName] = useState("")
  const [showCreateBatch, setShowCreateBatch] = useState(false)
  const [isCreatingBatch, setIsCreatingBatch] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId)

  const createBatch = async () => {
    if (!newBatchName.trim() || isCreatingBatch) return

    setIsCreatingBatch(true)
    try {
      // Call FastAPI backend to create batch
      const requestBody: BatchCreateRequest = {
        name: newBatchName.trim(),
        description: null, // Optional field
      }

      const response = await fetch(getApiUrl('batches'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Failed to create batch: ${response.statusText}`)
      }

      const backendBatch: BatchCreateResponse = await response.json()

      // Create frontend batch object with backend data
      const newBatch: ImageBatch = {
        id: backendBatch.id.toString(), // Convert to string for frontend consistency
        name: backendBatch.name,
        createdAt: new Date(), // Use current time for frontend
        images: [],
        filters: [],
      }

      setBatches([...batches, newBatch])
      setSelectedBatchId(newBatch.id)
      setNewBatchName("")
      setShowCreateBatch(false)
    } catch (error) {
      console.error('Error creating batch:', error)
      // You might want to show a toast notification or error message to the user
      alert('Failed to create batch. Please try again.')
    } finally {
      setIsCreatingBatch(false)
    }
  }

  const uploadFile = async (file: File, batchId: string): Promise<ProcessedImage | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('batch_id', batchId)

      const response = await fetch(getApiUrl('fileUpload'), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}: ${response.statusText}`)
      }

      const uploadResponse: FileUploadResponse = await response.json()

      // Create ProcessedImage from backend response
      const processedImage: ProcessedImage = {
        id: uploadResponse.document.id.toString(),
        originalFile: file,
        originalUrl: `${API_CONFIG.baseUrl}${uploadResponse.url}`,
        filters: [],
        name: uploadResponse.document.file_name,
        batchId: batchId,
        // Store additional backend data
        fileId: uploadResponse.file_id,
        documentId: uploadResponse.document.id,
        fileSize: uploadResponse.document.file_size,
        fileType: uploadResponse.document.file_type,
      }

      return processedImage
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error)
      return null
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!selectedBatchId || isUploading) return

      setIsUploading(true)
      const uploadedImages: ProcessedImage[] = []

      try {
        // Upload files one by one to track progress
        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i]
          const fileKey = `${file.name}-${i}`
          
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            [fileKey]: 0
          }))

          const uploadedImage = await uploadFile(file, selectedBatchId)
          
          if (uploadedImage) {
            uploadedImages.push(uploadedImage)
            // Update progress to 100%
            setUploadProgress(prev => ({
              ...prev,
              [fileKey]: 100
            }))
          } else {
            // Remove failed upload from progress
            setUploadProgress(prev => {
              const newProgress = { ...prev }
              delete newProgress[fileKey]
              return newProgress
            })
          }
        }

        // Update batches with successfully uploaded images
        if (uploadedImages.length > 0) {
          setBatches(
            batches.map((batch) =>
              batch.id === selectedBatchId 
                ? { ...batch, images: [...batch.images, ...uploadedImages] } 
                : batch,
            ),
          )

          // Auto-select first uploaded image if none selected
          if (!selectedImageId && uploadedImages.length > 0) {
            setSelectedImageId(uploadedImages[0].id)
          }
        }

        // Clear progress after a delay
        setTimeout(() => {
          setUploadProgress({})
        }, 2000)

      } catch (error) {
        console.error('Upload error:', error)
        alert('Some files failed to upload. Please try again.')
      } finally {
        setIsUploading(false)
      }
    },
    [batches, setBatches, selectedBatchId, selectedImageId, setSelectedImageId, isUploading],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"],
    },
    multiple: true,
    disabled: !selectedBatchId || isUploading, // Disable if no batch selected or uploading
  })

  const removeImage = (imageId: string) => {
    setBatches(
      batches.map((batch) => ({
        ...batch,
        images: batch.images.filter((img) => img.id !== imageId),
      })),
    )

    if (selectedImageId === imageId) {
      const remainingImages = selectedBatch?.images.filter((img) => img.id !== imageId) || []
      setSelectedImageId(remainingImages.length > 0 ? remainingImages[0].id : null)
    }
  }

  const removeBatch = (batchId: string) => {
    setBatches(batches.filter((batch) => batch.id !== batchId))
    if (selectedBatchId === batchId) {
      setSelectedBatchId(null)
      setSelectedImageId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderPlus className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Batch Management</h3>
          <Badge variant="secondary">{batches.length} batches</Badge>
        </div>
        <Button size="sm" onClick={() => setShowCreateBatch(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Batch
        </Button>
      </div>

      {/* Create Batch Form */}
      {showCreateBatch && (
        <Card className="p-4 border-primary/20">
          <div className="space-y-3">
            <Label htmlFor="batch-name">Batch Name</Label>
            <Input
              id="batch-name"
              placeholder="e.g., training-batch, product-photos"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBatch()}
            />
            <div className="flex gap-2">
              <Button onClick={createBatch} disabled={!newBatchName.trim() || isCreatingBatch}>
                {isCreatingBatch ? "Creating..." : "Create Batch"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateBatch(false)
                  setNewBatchName("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Batch List */}
      {batches.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Your Batches</h4>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {batches.map((batch) => (
                <Card
                  key={batch.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedBatchId === batch.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                  onClick={() => setSelectedBatchId(batch.id)}
                >
                  <div className="flex items-center gap-3">
                    <Folder className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{batch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch.images.length} images • {batch.filters.length} batch filters
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeBatch(batch.id)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Upload Area */}
      {selectedBatch ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Upload to: {selectedBatch.name}</span>
            <Badge variant="secondary">{selectedBatch.images.length} images</Badge>
          </div>

          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragActive || dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
              ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
            ) : (
              <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground mb-1">
              {isUploading ? "Uploading files..." : "Drag & drop images here, or click to select"}
            </p>
            <p className="text-xs text-muted-foreground">Supports PNG, JPG, GIF, WebP</p>
          </div>

          {/* Upload Progress */}
          {isUploading && Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Upload Progress</h4>
              {Object.entries(uploadProgress).map(([fileKey, progress]) => (
                <div key={fileKey} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="truncate">{fileKey.split('-')[0]}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ))}
            </div>
          )}

          {/* Images in Selected Batch */}
          {selectedBatch.images.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Images in {selectedBatch.name}</h4>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {selectedBatch.images.map((image) => (
                    <Card
                      key={image.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedImageId === image.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-accent"
                      }`}
                      onClick={() => setSelectedImageId(image.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={image.originalUrl || "/placeholder.svg"}
                          alt={image.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{image.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {image.filters.length > 0 ? `${image.filters.length} filters` : "No filters"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(image.id)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      ) : (
        <Card className="p-6 text-center border-dashed">
          <FolderPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">Create a batch to start uploading images</p>
          <p className="text-xs text-muted-foreground">Organize your images into named batches for better management</p>
        </Card>
      )}
    </div>
  )
}
