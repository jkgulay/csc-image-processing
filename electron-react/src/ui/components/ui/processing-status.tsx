"use client"

import { Card } from "./card"
import { Progress } from "./progress"
import { Badge } from "./badge"
import { CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

interface ProcessingStep {
  id: string
  name: string
  status: "pending" | "processing" | "completed" | "error"
  progress?: number
  message?: string
}

interface ProcessingStatusProps {
  steps: ProcessingStep[]
  currentStep?: string
  className?: string
}

export function ProcessingStatus({ steps, currentStep, className }: ProcessingStatusProps) {
  const getStepIcon = (status: ProcessingStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStepBadge = (status: ProcessingStep["status"]) => {
    const variants = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      error: "destructive",
    } as const

    const labels = {
      pending: "Pending",
      processing: "Processing",
      completed: "Done",
      error: "Error",
    }

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    )
  }

  return (
    <Card className={cn("p-4", className)}>
      <h3 className="font-semibold mb-4">Processing Status</h3>
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-colors",
              currentStep === step.id && "bg-primary/5 border border-primary/20",
            )}
          >
            {getStepIcon(step.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium truncate">{step.name}</p>
                {getStepBadge(step.status)}
              </div>
              {step.message && <p className="text-xs text-muted-foreground">{step.message}</p>}
              {step.status === "processing" && step.progress !== undefined && (
                <Progress value={step.progress} className="mt-2 h-1" />
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
