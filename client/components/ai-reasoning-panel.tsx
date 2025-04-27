"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Brain, CornerDownRight, Route } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AIReasoningPanelProps {
  activeEmergency: boolean
  emergencyType: "fire" | "medical" | "police" | null
  emergencyLocation: { x: number; y: number } | null
}

const AIReasoningPanel: React.FC<AIReasoningPanelProps> = ({ activeEmergency, emergencyType, emergencyLocation }) => {
  const [reasoningSteps, setReasoningSteps] = useState<string[]>([])
  const [isThinking, setIsThinking] = useState(false)

  useEffect(() => {
    if (activeEmergency && emergencyType && emergencyLocation) {
      setIsThinking(true)
      setReasoningSteps([])

      // Simulate AI reasoning with delayed steps
      const steps = [
        "Analyzing current traffic conditions...",
        `Identified emergency: ${emergencyType} at ${emergencyLocation.x}th and ${emergencyLocation.y}th Street.`,
        "Calculating optimal route options...",
        "Evaluating traffic density on potential paths...",
        `Route option 1: Via Market Street (ETA: 3m 42s)`,
        `Route option 2: Via Pine Street (ETA: 3m 24s)`,
        "Selected optimal route: Pine Street",
        "Coordinating traffic light sequence...",
        "Instructing traffic light agents to prioritize north-south flow at intersections 3, 5, and 7",
        "Monitoring real-time traffic flow adjustments...",
        "Route clearance complete. Emergency vehicle ETA: 3m 24s (47% time saved)",
      ]

      // Add steps with delays to simulate thinking
      let delay = 500
      steps.forEach((step, index) => {
        setTimeout(() => {
          setReasoningSteps((prev) => [...prev, step])
          if (index === steps.length - 1) {
            setIsThinking(false)
          }
        }, delay)
        delay += Math.random() * 1000 + 500
      })
    } else {
      setReasoningSteps([])
    }
  }, [activeEmergency, emergencyType, emergencyLocation])

  if (!activeEmergency) {
    return (
      <Card className="border-gray-600 bg-gray-700 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">AI Reasoning</h3>
          <Badge variant="outline" className="bg-gray-600 text-white">
            Standby
          </Badge>
        </div>

        <div className="flex h-64 flex-col items-center justify-center rounded-md border border-gray-600 bg-gray-600 p-4 text-center text-white">
          <Brain className="mb-2 h-10 w-10 text-gray-700" />
          <p>No active emergency</p>
          <p className="mt-2 text-sm text-gray-400">Trigger an emergency to see AI reasoning in action</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-gray-600 bg-gray-700 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">AI Reasoning</h3>
        <Badge
          variant="outline"
          className={isThinking ? "bg-yellow-900/30 text-yellow-500" : "bg-green-900/30 text-green-500"}
        >
          {isThinking ? "Processing..." : "Analysis Complete"}
        </Badge>
      </div>

      <div className="h-64 overflow-y-auto rounded-md border border-gray-600 bg-gray-600 p-4">
        {reasoningSteps.length > 0 ? (
          <div className="space-y-2">
            {reasoningSteps.map((step, index) => (
              <div key={index} className="flex">
                <CornerDownRight className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                <p className="text-sm text-white">{step}</p>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center text-yellow-500">
                <CornerDownRight className="mr-2 h-4 w-4 shrink-0" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-300">
            <Route className="mb-2 h-8 w-8 animate-pulse text-yellow-500" />
            <p>Initializing AI reasoning engine...</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default AIReasoningPanel
