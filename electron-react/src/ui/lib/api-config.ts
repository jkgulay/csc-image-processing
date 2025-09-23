// API Configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  endpoints: {
    batches: '/batches',
    documents: '/documents',
    filteredImages: '/filtered-images',
    exports: '/exports',
    fileUpload: '/files/upload',
  },
} as const

// Helper function to get full API URL
export const getApiUrl = (endpoint: keyof typeof API_CONFIG.endpoints): string => {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`
}

// Types for API requests/responses
export interface BatchCreateRequest {
  name: string
  description?: string | null
}

export interface BatchCreateResponse {
  id: number
  name: string
}

// File upload types
export interface FileUploadResponse {
  file_id: string
  url: string
  document: {
    id: number
    file_name: string
    file_type: string
    file_size: number
  }
  document_batch: {
    id: number
    batch_id: number
    document_id: number
  }
}
