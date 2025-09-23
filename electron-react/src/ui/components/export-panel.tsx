"use client"

import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Label } from "../components/ui/label"
import { Slider } from "../components/ui/slider"
import { Separator } from "../components/ui/separator"
import { Progress } from "../components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { useToast } from "../hooks/use-toast"
import { Download, FileImage, FileText, Package, Loader2, CheckCircle, FolderOpen } from "lucide-react"
import type { ProcessedImage, ImageBatch } from "../app/page"

interface ExportPanelProps {
  batches: ImageBatch[]
  selectedBatch?: ImageBatch
  selectedImage?: ProcessedImage
}

type ExportFormat = "png" | "jpg" | "webp" | "pdf"
type ExportMode = "single" | "batch" | "all-batches" | "report"

export function ExportPanel({ batches, selectedBatch, selectedImage }: ExportPanelProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png")
  const [exportMode, setExportMode] = useState<ExportMode>("single")
  const [quality, setQuality] = useState([90])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const { toast } = useToast()

  const allProcessedImages = batches.flatMap((batch) =>
    batch.images.filter((img) => img.processedUrl && img.filters.length > 0),
  )
  const selectedBatchProcessedImages =
    selectedBatch?.images.filter((img) => img.processedUrl && img.filters.length > 0) || []

  const canExportSingle = selectedImage?.fileId && selectedImage.filters.length > 0
  const canExportBatch = selectedBatchProcessedImages.length > 0
  const canExportAllBatches = allProcessedImages.length > 0
  const processedBatches = batches.filter((batch) =>
    batch.images.some((img) => img.processedUrl && img.filters.length > 0),
  )

  const downloadFromUrl = (url: string, filename?: string) => {
    const a = document.createElement("a")
    a.href = url
    if (filename) {
      a.download = filename
    }
    // Remove target="_blank" to prevent new window opening
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const downloadBatchZip = async (batchId: string, batchName: string) => {
    const apiUrl = `http://127.0.0.1:8000/batches/${batchId}/filtered-images/zip`
    
    try {
      setExportProgress(30)
      
      // Use fetch to get the file and create a blob URL to avoid new window
      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      setExportProgress(70)
      
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      setExportProgress(90)
      
      // Download using blob URL
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `${batchName}_processed.zip`
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl)
      
      setExportProgress(100)
    } catch (error) {
      console.error('Batch download failed:', error)
      throw error
    }
  }

  const exportSingle = async () => {
    if (!selectedImage?.fileId) {
      toast({
        title: "Export Failed",
        description: "No file ID available for this image",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)
    setExportProgress(0)

    try {
      setExportProgress(50)
      
      // Use FastAPI endpoint to download single file
      const apiUrl = `http://127.0.0.1:8000/files/${selectedImage.fileId}`
      downloadFromUrl(apiUrl, selectedImage.name)
      
      setExportProgress(100)

      toast({
        title: "Export Complete",
        description: `Successfully exported ${selectedImage.name}`,
      })
    } catch (error) {
      console.error("Export failed:", error)
      toast({
        title: "Export Failed",
        description: "There was an error exporting your image",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 1000)
    }
  }

  const exportBatch = async () => {
    if (!selectedBatch || selectedBatchProcessedImages.length === 0) return

    setIsExporting(true)
    setExportProgress(0)

    try {
      await downloadBatchZip(selectedBatch.id, selectedBatch.name)

      toast({
        title: "Batch Export Complete",
        description: `Successfully exported ${selectedBatchProcessedImages.length} images from ${selectedBatch.name}`,
      })
    } catch (error) {
      console.error("Batch export failed:", error)
      toast({
        title: "Batch Export Failed",
        description: "There was an error during batch export",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 1000)
    }
  }

  const exportAllBatches = async () => {
    if (processedBatches.length === 0) return

    setIsExporting(true)
    setExportProgress(0)

    try {
      let completed = 0
      const total = processedBatches.length

      for (const batch of processedBatches) {
        const batchProcessedImages = batch.images.filter((img) => img.processedUrl && img.filters.length > 0)
        
        if (batchProcessedImages.length > 0) {
          await downloadBatchZip(batch.id, batch.name)
          
          completed++
          setExportProgress((completed / total) * 100)
          
          // Add small delay between batch downloads
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      toast({
        title: "All Batches Export Complete",
        description: `Successfully exported ${completed} batches as ZIP files`,
      })
    } catch (error) {
      console.error("All batches export failed:", error)
      toast({
        title: "Export Failed",
        description: "There was an error during export",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 1000)
    }
  }

  const exportReport = async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      setExportProgress(25)

      const reportContent = `
IMAGE PROCESSING REPORT
Generated: ${new Date().toLocaleString()}
========================================

SUMMARY
-------
Total Batches: ${batches.length}
Processed Batches: ${processedBatches.length}
Total Images Processed: ${allProcessedImages.length}
Export Format: ${exportFormat.toUpperCase()}
Quality Setting: ${quality[0]}%
Processing Date: ${new Date().toDateString()}

BATCH DETAILS
-------------
${processedBatches
  .map((batch, batchIndex) => {
    const batchProcessedImages = batch.images.filter((img) => img.processedUrl && img.filters.length > 0)
    return `
${batchIndex + 1}. BATCH: ${batch.name}
   Created: ${batch.createdAt.toLocaleString()}
   Total Images: ${batch.images.length}
   Processed Images: ${batchProcessedImages.length}
   Batch Filters: ${batch.filters.length > 0 ? batch.filters.join(", ") : "None"}
   
   IMAGES IN BATCH:
   ${batchProcessedImages
     .map(
       (img, imgIndex) => `
   ${imgIndex + 1}. ${img.name}
      Filters Applied: ${img.filters.join(", ")}
      Original Size: ${(img.originalFile.size / 1024 / 1024).toFixed(2)} MB
      Processed Size: ${img.processedBlob ? (img.processedBlob.size / 1024 / 1024).toFixed(2) : "N/A"} MB
      Size Reduction: ${
        img.processedBlob
          ? Math.round(((img.originalFile.size - img.processedBlob.size) / img.originalFile.size) * 100)
          : 0
      }%`,
     )
     .join("")}
`
  })
  .join("")}

FILTER STATISTICS
-----------------
${(() => {
  const filterCounts: Record<string, number> = {}
  allProcessedImages.forEach((img) => {
    img.filters.forEach((filter) => {
      filterCounts[filter] = (filterCounts[filter] || 0) + 1
    })
  })

  return Object.entries(filterCounts)
    .map(([filter, count]) => `${filter}: Used ${count} times`)
    .join("\n")
})()}

BATCH FILTER STATISTICS
-----------------------
${processedBatches
  .map((batch) => `${batch.name}: ${batch.filters.length > 0 ? batch.filters.join(", ") : "No batch filters"}`)
  .join("\n")}

TECHNICAL DETAILS
-----------------
Browser: ${navigator.userAgent}
Processing Engine: Canvas 2D API
Export Formats Supported: PNG, JPG, WebP, PDF Report
Batch Processing: Enabled
Side-by-Side Comparison: Enabled
Batch Management: Enabled

========================================
Report generated by Image Processor v2.0
      `

      setExportProgress(75)

      const blob = new Blob([reportContent], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      setExportProgress(100)

      const a = document.createElement("a")
      a.href = url
      a.download = `batch_processing_report_${new Date().toISOString().split("T")[0]}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Report Generated",
        description: "Batch processing report has been downloaded",
      })
    } catch (error) {
      console.error("Report export failed:", error)
      toast({
        title: "Report Export Failed",
        description: "There was an error generating the report",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 1000)
    }
  }

  const handleExport = () => {
    switch (exportMode) {
      case "single":
        exportSingle()
        break
      case "batch":
        exportBatch()
        break
      case "all-batches":
        exportAllBatches()
        break
      case "report":
        exportReport()
        break
    }
  }

  const getExportButtonText = () => {
    if (isExporting) return "Exporting..."
    switch (exportMode) {
      case "single":
        return "Download Image"
      case "batch":
        return `Download Batch ZIP (${selectedBatchProcessedImages.length})`
      case "all-batches":
        return `Download All as ZIPs (${processedBatches.length})`
      case "report":
        return "Generate Report"
      default:
        return "Download"
    }
  }

  const canExport = () => {
    switch (exportMode) {
      case "single":
        return canExportSingle
      case "batch":
        return canExportBatch
      case "all-batches":
        return canExportAllBatches
      case "report":
        return allProcessedImages.length > 0
      default:
        return false
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Download className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Download Options</h3>
        {allProcessedImages.length > 0 && <Badge variant="secondary">{allProcessedImages.length} ready</Badge>}
      </div>

      <div className="space-y-4">
        {/* Export Mode Tabs */}
        <Tabs value={exportMode} onValueChange={(value) => setExportMode(value as ExportMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-1">
              <FileImage className="h-3 w-3" />
              Single
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              Batch
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-3">
            <Card className="p-3">
              <p className="text-sm font-medium">Download Selected Image</p>
              <p className="text-xs text-muted-foreground">
                {selectedImage 
                  ? `Ready: ${selectedImage.name} ${selectedImage.fileId ? '(File ID: ' + selectedImage.fileId + ')' : '(No File ID)'}` 
                  : "No image selected"}
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="batch" className="space-y-3">
            <Card className="p-3">
              <p className="text-sm font-medium">Download Current Batch as ZIP</p>
              <p className="text-xs text-muted-foreground">
                {selectedBatch
                  ? `${selectedBatch.name} (ID: ${selectedBatch.id}): ${selectedBatchProcessedImages.length} processed images`
                  : "No batch selected"}
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Additional Export Options */}
        <div className="space-y-2">
          <Label>Additional Options</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={exportMode === "all-batches" ? "default" : "outline"}
              size="sm"
              onClick={() => setExportMode("all-batches")}
              disabled={!canExportAllBatches}
            >
              <Package className="h-4 w-4 mr-1" />
All as ZIPs
            </Button>
            <Button
              variant={exportMode === "report" ? "default" : "outline"}
              size="sm"
              onClick={() => setExportMode("report")}
              disabled={allProcessedImages.length === 0}
            >
              <FileText className="h-4 w-4 mr-1" />
              Report
            </Button>
          </div>
        </div>

        {/* Backend Download Info */}
        {exportMode !== "report" && (
          <Card className="p-3 bg-blue-50 border-blue-200">
            <p className="text-sm font-medium text-blue-800">Backend Download</p>
            <p className="text-xs text-blue-600">
              {exportMode === "single" 
                ? "Files will be downloaded directly from the FastAPI backend"
                : "Batch downloads will be provided as ZIP files from the backend"
              }
            </p>
          </Card>
        )}

        {/* Export Progress */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Exporting...</span>
              <span>{Math.round(exportProgress)}%</span>
            </div>
            <Progress value={exportProgress} className="w-full" />
          </div>
        )}

        <Separator />

        {/* Export Status */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Current Batch:</p>
              <p className="font-medium">{selectedBatch ? selectedBatch.name : "None"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Processed:</p>
              <p className="font-medium">{allProcessedImages.length}</p>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <Button onClick={handleExport} disabled={!canExport() || isExporting} className="w-full">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {getExportButtonText()}
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              {getExportButtonText()}
            </>
          )}
        </Button>

        {/* Export Info */}
        {exportMode === "single" && !canExportSingle && (
          <Card className="p-3 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              {!selectedImage 
                ? "Select an image to enable download"
                : !selectedImage.fileId 
                ? "Selected image has no file ID for download"
                : "Process the image to enable download"}
            </p>
          </Card>
        )}

        {exportMode === "batch" && !canExportBatch && (
          <Card className="p-3 bg-muted/50">
            <p className="text-sm text-muted-foreground">
              {!selectedBatch
                ? "Select a batch to enable ZIP download"
                : "Process at least one image in the current batch"}
            </p>
          </Card>
        )}

        {exportMode === "all-batches" && !canExportAllBatches && (
          <Card className="p-3 bg-muted/50">
            <p className="text-sm text-muted-foreground">Process images in at least one batch to enable ZIP downloads</p>
          </Card>
        )}

        {exportProgress === 100 && !isExporting && (
          <Card className="p-3 bg-primary/10 border-primary/20">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-4 w-4" />
              <p className="text-sm font-medium">Export completed successfully!</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
