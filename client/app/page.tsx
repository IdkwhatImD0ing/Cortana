"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, Clock, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import CityMap from "@/components/city-map"
import EmergencyPanel from "@/components/emergency-panel"
import AIReasoningPanel from "@/components/ai-reasoning-panel"
import TrafficLightStatus from "@/components/traffic-light-status"
import IncidentReport from "@/components/incident-report"

export default function Home() {
  const [activeEmergency, setActiveEmergency] = useState(false)
  const [emergencyType, setEmergencyType] = useState<"fire" | "medical" | "police" | null>(null)
  const [emergencyLocation, setEmergencyLocation] = useState<{ x: number; y: number } | null>(null)
  const [incidentReports, setIncidentReports] = useState<any[]>([])
  const [simulationTime, setSimulationTime] = useState(0)
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)

  const simulationInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isSimulationRunning) {
      simulationInterval.current = setInterval(() => {
        setSimulationTime((prev) => prev + 1)
      }, 1000)
    } else if (simulationInterval.current) {
      clearInterval(simulationInterval.current)
    }

    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current)
      }
    }
  }, [isSimulationRunning])

  const handleEmergencyTrigger = (type: "fire" | "medical" | "police", location: { x: number; y: number }) => {
    setActiveEmergency(true)
    setEmergencyType(type)
    setEmergencyLocation(location)
    setIsSimulationRunning(true)

    // Simulate an incident report after 15 seconds
    setTimeout(() => {
      const newReport = {
        id: Date.now(),
        type,
        location: `${location.x}th and ${location.y}th Street`,
        dispatchTime: new Date().toLocaleTimeString(),
        arrivalTime: "3 minutes 24 seconds",
        timeSaved: "47%",
        routeCleared: ["Market St", "Pine St"],
      }

      setIncidentReports((prev) => [newReport, ...prev])
      setActiveEmergency(false)
      setEmergencyType(null)
      setEmergencyLocation(null)
      setIsSimulationRunning(false)
      setSimulationTime(0)
    }, 15000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  return (
    <main className="min-h-screen bg-gray-800 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-700 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-emerald-500" />
            <h1 className="text-xl font-bold">CityMind</h1>
            <Badge variant="outline" className="ml-2 bg-emerald-900/30 text-emerald-300">
              AI-Powered Emergency Traffic Command
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            {isSimulationRunning && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-yellow-500">{formatTime(simulationTime)}</span>
              </div>
            )}
            <Button variant={activeEmergency ? "destructive" : "outline"} size="sm" disabled={activeEmergency}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              {activeEmergency ? "Emergency Active" : "System Ready"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main visualization area */}
          <div className="col-span-1 lg:col-span-2">
            <Card className="border-gray-700 bg-gray-800 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">City Playground Simulator</h2>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-blue-700 text-white">
                    Live Traffic
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-700 text-white">
                    AI Optimized
                  </Badge>
                </div>
              </div>
              <div className="aspect-square w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-700">
                <CityMap
                  activeEmergency={activeEmergency}
                  emergencyType={emergencyType}
                  emergencyLocation={emergencyLocation}
                  isSimulationRunning={isSimulationRunning}
                />
              </div>
            </Card>
          </div>

          {/* Control panels */}
          <div className="col-span-1">
            <Tabs defaultValue="emergency" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="emergency">Emergency</TabsTrigger>
                <TabsTrigger value="ai">AI Reasoning</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="emergency">
                <EmergencyPanel onTriggerEmergency={handleEmergencyTrigger} isDisabled={activeEmergency} />
              </TabsContent>

              <TabsContent value="ai">
                <AIReasoningPanel
                  activeEmergency={activeEmergency}
                  emergencyType={emergencyType}
                  emergencyLocation={emergencyLocation}
                />
              </TabsContent>

              <TabsContent value="reports">
                <Card className="border-gray-700 bg-gray-800 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Incident Reports</h3>
                  {incidentReports.length > 0 ? (
                    <div className="space-y-4">
                      {incidentReports.map((report) => (
                        <IncidentReport key={report.id} report={report} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-gray-800 bg-gray-900 p-4 text-center text-gray-400">
                      No incident reports yet
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="mt-4 border-gray-700 bg-gray-800 p-4">
              <h3 className="mb-4 text-lg font-semibold">Traffic Light System</h3>
              <TrafficLightStatus activeEmergency={activeEmergency} emergencyType={emergencyType} />
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
