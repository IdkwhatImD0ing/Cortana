"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { CircleOff, CircleCheck, AlertTriangle } from "lucide-react"

interface TrafficLightStatusProps {
  activeEmergency: boolean
  emergencyType: "fire" | "medical" | "police" | null
}

interface TrafficLightAgent {
  id: number
  intersection: string
  status: "normal" | "emergency" | "coordinating"
  message: string
}

const TrafficLightStatus: React.FC<TrafficLightStatusProps> = ({ activeEmergency, emergencyType }) => {
  const [agents, setAgents] = useState<TrafficLightAgent[]>([
    { id: 1, intersection: "Market & 5th", status: "normal", message: "Normal operation" },
    { id: 2, intersection: "Pine & 3rd", status: "normal", message: "Normal operation" },
    { id: 3, intersection: "Main & 7th", status: "normal", message: "Normal operation" },
    { id: 4, intersection: "Oak & 2nd", status: "normal", message: "Normal operation" },
  ])

  useEffect(() => {
    if (activeEmergency) {
      // Simulate traffic light agents responding to emergency
      const updatedAgents = agents.map((agent, index) => {
        // Stagger the updates to simulate real-time coordination
        setTimeout(() => {
          setAgents((prev) => {
            const newAgents = [...prev]
            newAgents[index] = {
              ...newAgents[index],
              status: "coordinating",
              message: "Receiving emergency signal...",
            }
            return newAgents
          })

          // Then update to emergency mode
          setTimeout(
            () => {
              setAgents((prev) => {
                const newAgents = [...prev]
                newAgents[index] = {
                  ...newAgents[index],
                  status: "emergency",
                  message: index % 2 === 0 ? "Prioritizing north-south flow" : "Prioritizing east-west flow",
                }
                return newAgents
              })
            },
            1500 + index * 500,
          )
        }, index * 1000)

        return agent
      })
    } else {
      // Reset to normal operation
      setAgents((prev) =>
        prev.map((agent) => ({
          ...agent,
          status: "normal",
          message: "Normal operation",
        })),
      )
    }
  }, [activeEmergency])

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className={`flex items-center justify-between rounded-md border p-2 ${
            agent.status === "normal"
              ? "border-gray-600 bg-gray-600 text-white"
              : agent.status === "coordinating"
                ? "border-yellow-700 bg-yellow-800/50 text-white"
                : "border-green-700 bg-green-800/50 text-white"
          }`}
        >
          <div className="flex items-center">
            {agent.status === "normal" ? (
              <CircleOff className="mr-2 h-4 w-4 text-gray-400" />
            ) : agent.status === "coordinating" ? (
              <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500 animate-pulse" />
            ) : (
              <CircleCheck className="mr-2 h-4 w-4 text-green-500" />
            )}
            <span className="text-sm text-white">{agent.intersection}</span>
          </div>
          <span
            className={`text-xs ${
              agent.status === "normal"
                ? "text-gray-200"
                : agent.status === "coordinating"
                  ? "text-yellow-300"
                  : "text-green-300"
            }`}
          >
            {agent.message}
          </span>
        </div>
      ))}
    </div>
  )
}

export default TrafficLightStatus
