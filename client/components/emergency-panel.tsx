"use client"

import type React from "react"

import { useState } from "react"
import { Flame, Stethoscope, Shield, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface EmergencyPanelProps {
  onTriggerEmergency: (type: "fire" | "medical" | "police", location: { x: number; y: number }) => void
  isDisabled: boolean
}

const EmergencyPanel: React.FC<EmergencyPanelProps> = ({ onTriggerEmergency, isDisabled }) => {
  const [selectedType, setSelectedType] = useState<"fire" | "medical" | "police">("fire")
  const [location, setLocation] = useState({ x: 5, y: 5 })

  const handleTrigger = () => {
    onTriggerEmergency(selectedType, location)
  }

  return (
    <Card className="border-gray-600 bg-gray-700 p-4">
      <h3 className="mb-4 text-lg font-semibold text-white">Emergency Trigger</h3>

      <div className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-medium text-white">Emergency Type</h4>
          <RadioGroup
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as "fire" | "medical" | "police")}
            className="grid grid-cols-3 gap-2"
          >
            <div>
              <RadioGroupItem value="fire" id="fire" className="peer sr-only" />
              <Label
                htmlFor="fire"
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-gray-600 bg-gray-600 p-4 hover:bg-gray-500 peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:bg-red-700/50 text-white"
              >
                <Flame className="mb-2 h-6 w-6 text-red-500" />
                <span>Fire</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="medical" id="medical" className="peer sr-only" />
              <Label
                htmlFor="medical"
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-gray-600 bg-gray-600 p-4 hover:bg-gray-500 peer-data-[state=checked]:border-white peer-data-[state=checked]:bg-white/30 text-white"
              >
                <Stethoscope className="mb-2 h-6 w-6 text-white" />
                <span>Medical</span>
              </Label>
            </div>

            <div>
              <RadioGroupItem value="police" id="police" className="peer sr-only" />
              <Label
                htmlFor="police"
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-gray-600 bg-gray-600 p-4 hover:bg-gray-500 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-700/50 text-white"
              >
                <Shield className="mb-2 h-6 w-6 text-blue-500" />
                <span>Police</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Location (X)</h4>
            <span className="text-sm text-gray-400">{location.x}</span>
          </div>
          <Slider
            value={[location.x]}
            min={0}
            max={10}
            step={1}
            onValueChange={(value) => setLocation({ ...location, x: value[0] })}
            className="mb-4"
          />

          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Location (Y)</h4>
            <span className="text-sm text-gray-400">{location.y}</span>
          </div>
          <Slider
            value={[location.y]}
            min={0}
            max={10}
            step={1}
            onValueChange={(value) => setLocation({ ...location, y: value[0] })}
          />

          <div className="mt-4 flex items-center justify-center rounded-md border border-gray-600 bg-gray-600 p-2">
            <MapPin className="mr-2 h-4 w-4 text-gray-300" />
            <span className="text-sm text-white">
              Location: {location.x}th and {location.y}th Street
            </span>
          </div>
        </div>

        <Button
          onClick={handleTrigger}
          className="w-full"
          disabled={isDisabled}
          variant={selectedType === "fire" ? "destructive" : selectedType === "police" ? "default" : "outline"}
        >
          {isDisabled ? "Emergency in Progress" : "Trigger Emergency"}
        </Button>
      </div>
    </Card>
  )
}

export default EmergencyPanel
