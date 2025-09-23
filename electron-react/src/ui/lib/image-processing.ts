export interface FilterOptions {
  brightness?: number
  contrast?: number
  saturation?: number
  blur?: number
  sharpen?: boolean
  vintage?: boolean
  edgeDetection?: boolean
  faceDetection?: boolean
}

export class ImageProcessor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = document.createElement("canvas")
    this.ctx = this.canvas.getContext("2d")!
  }

  async processImage(imageUrl: string, filters: FilterOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        this.canvas.width = img.width
        this.canvas.height = img.height
        this.ctx.drawImage(img, 0, 0)

        try {
          this.applyFilters(filters)
          this.canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to create blob"))
            }
          }, "image/png")
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = imageUrl
    })
  }

  private applyFilters(filters: FilterOptions) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    // Apply brightness
    if (filters.brightness !== undefined) {
      const brightness = filters.brightness - 50
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] + brightness))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness))
      }
    }

    // Apply contrast
    if (filters.contrast !== undefined) {
      const contrast = filters.contrast / 50
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128))
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128))
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128))
      }
    }

    // Apply saturation
    if (filters.saturation !== undefined) {
      const saturation = filters.saturation / 50
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = Math.min(255, Math.max(0, gray + saturation * (data[i] - gray)))
        data[i + 1] = Math.min(255, Math.max(0, gray + saturation * (data[i + 1] - gray)))
        data[i + 2] = Math.min(255, Math.max(0, gray + saturation * (data[i + 2] - gray)))
      }
    }

    // Apply vintage effect
    if (filters.vintage) {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        data[i] = Math.min(255, r * 0.9 + g * 0.5 + b * 0.1)
        data[i + 1] = Math.min(255, r * 0.3 + g * 0.8 + b * 0.1)
        data[i + 2] = Math.min(255, r * 0.2 + g * 0.3 + b * 0.5)
      }
    }

    // Apply edge detection (simplified Sobel operator)
    if (filters.edgeDetection) {
      const width = this.canvas.width
      const height = this.canvas.height
      const newData = new Uint8ClampedArray(data)

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4

          // Sobel X kernel
          const sobelX =
            -1 * this.getGray(data, (y - 1) * width + (x - 1)) +
            1 * this.getGray(data, (y - 1) * width + (x + 1)) +
            -2 * this.getGray(data, y * width + (x - 1)) +
            2 * this.getGray(data, y * width + (x + 1)) +
            -1 * this.getGray(data, (y + 1) * width + (x - 1)) +
            1 * this.getGray(data, (y + 1) * width + (x + 1))

          // Sobel Y kernel
          const sobelY =
            -1 * this.getGray(data, (y - 1) * width + (x - 1)) +
            -2 * this.getGray(data, (y - 1) * width + x) +
            -1 * this.getGray(data, (y - 1) * width + (x + 1)) +
            1 * this.getGray(data, (y + 1) * width + (x - 1)) +
            2 * this.getGray(data, (y + 1) * width + x) +
            1 * this.getGray(data, (y + 1) * width + (x + 1))

          const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY)
          const value = Math.min(255, magnitude)

          newData[idx] = value
          newData[idx + 1] = value
          newData[idx + 2] = value
        }
      }

      for (let i = 0; i < data.length; i++) {
        data[i] = newData[i]
      }
    }

    this.ctx.putImageData(imageData, 0, 0)

    // Apply blur using canvas filter (if supported)
    if (filters.blur && filters.blur > 0) {
      this.ctx.filter = `blur(${filters.blur}px)`
      this.ctx.drawImage(this.canvas, 0, 0)
      this.ctx.filter = "none"
    }
  }

  private getGray(data: Uint8ClampedArray, idx: number): number {
    const pixelIdx = idx * 4
    return 0.299 * data[pixelIdx] + 0.587 * data[pixelIdx + 1] + 0.114 * data[pixelIdx + 2]
  }

  async convertFormat(blob: Blob, format: string, quality = 0.9): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.canvas.width = img.width
        this.canvas.height = img.height
        this.ctx.drawImage(img, 0, 0)

        const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`
        this.canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to convert format"))
            }
          },
          mimeType,
          quality,
        )
      }
      img.onerror = () => reject(new Error("Failed to load image for conversion"))
      img.src = URL.createObjectURL(blob)
    })
  }
}

export const imageProcessor = new ImageProcessor()
