"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"

interface CityMapProps {
  activeEmergency: boolean
  emergencyType: "fire" | "medical" | "police" | null
  emergencyLocation: { x: number; y: number } | null
  isSimulationRunning: boolean
}

interface Vehicle {
  id: number
  x: number
  y: number
  direction: "up" | "down" | "left" | "right"
  speed: number
  type: "car" | "emergency"
  emergencyType?: "fire" | "medical" | "police"
}

interface TrafficLight {
  id: number
  x: number
  y: number
  direction: "vertical" | "horizontal"
  status: "red" | "green"
}

const CityMap: React.FC<CityMapProps> = ({
  activeEmergency,
  emergencyType,
  emergencyLocation,
  isSimulationRunning,
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [trafficLights, setTrafficLights] = useState<TrafficLight[]>([])
  const [gridSize, setGridSize] = useState({ width: 10, height: 10 })
  const animationRef = useRef<number | null>(null)

  // Initialize the city grid
  useEffect(() => {
    // Create a grid of roads and intersections
    const lights: TrafficLight[] = []

    // Create traffic lights at intersections
    for (let x = 2; x < gridSize.width; x += 2) {
      for (let y = 2; y < gridSize.height; y += 2) {
        lights.push({
          id: lights.length,
          x,
          y,
          direction: Math.random() > 0.5 ? "vertical" : "horizontal",
          status: Math.random() > 0.5 ? "red" : "green",
        })
      }
    }

    setTrafficLights(lights)

    // Create random vehicles
    const initialVehicles: Vehicle[] = []
    for (let i = 0; i < 10; i++) {
      const isHorizontal = Math.random() > 0.5
      initialVehicles.push({
        id: i,
        x: isHorizontal
          ? Math.floor(Math.random() * gridSize.width)
          : Math.floor(Math.random() * (gridSize.width / 2)) * 2,
        y: isHorizontal
          ? Math.floor(Math.random() * (gridSize.height / 2)) * 2
          : Math.floor(Math.random() * gridSize.height),
        direction: isHorizontal ? (Math.random() > 0.5 ? "left" : "right") : Math.random() > 0.5 ? "up" : "down",
        speed: 0.05 + Math.random() * 0.05,
        type: "car",
      })
    }

    setVehicles(initialVehicles)
  }, [gridSize])

  // Add emergency vehicle when emergency is triggered
  useEffect(() => {
    if (activeEmergency && emergencyType && emergencyLocation) {
      // Add emergency vehicle at a random edge of the map
      const startPositions = [
        { x: 0, y: 2, direction: "right" },
        { x: gridSize.width - 1, y: 2, direction: "left" },
        { x: 2, y: 0, direction: "down" },
        { x: 2, y: gridSize.height - 1, direction: "up" },
      ]

      const startPos = startPositions[Math.floor(Math.random() * startPositions.length)]

      const emergencyVehicle: Vehicle = {
        id: vehicles.length,
        x: startPos.x,
        y: startPos.y,
        direction: startPos.direction as "up" | "down" | "left" | "right",
        speed: 0.15, // Emergency vehicles move faster
        type: "emergency",
        emergencyType,
      }

      setVehicles((prev) => [...prev, emergencyVehicle])

      // Update traffic lights to prioritize emergency route
      if (emergencyLocation) {
        const updatedLights = trafficLights.map((light) => {
          // Simplified logic: make lights green in the direction of emergency
          const isOnPath = light.x <= emergencyLocation.x && light.y <= emergencyLocation.y
          if (isOnPath) {
            return {
              ...light,
              status: "green",
              direction: light.x === emergencyLocation.x ? "vertical" : "horizontal",
            }
          }
          return light
        })

        setTrafficLights(updatedLights)
      }
    }
  }, [activeEmergency, emergencyType, emergencyLocation])

  // Animation loop for vehicle movement
  useEffect(() => {
    if (!isSimulationRunning) return

    const updateVehicles = () => {
      setVehicles((prevVehicles) => {
        return prevVehicles.map((vehicle) => {
          let newX = vehicle.x
          let newY = vehicle.y
          let newDirection = vehicle.direction

          // Move vehicle based on direction
          switch (vehicle.direction) {
            case "up":
              newY -= vehicle.speed
              break
            case "down":
              newY += vehicle.speed
              break
            case "left":
              newX -= vehicle.speed
              break
            case "right":
              newX += vehicle.speed
              break
          }

          // Check if vehicle is at an intersection
          const isAtIntersection = trafficLights.some(
            (light) => Math.abs(light.x - newX) < 0.2 && Math.abs(light.y - newY) < 0.2,
          )

          if (isAtIntersection && Math.random() > 0.9) {
            // Randomly change direction at intersections
            const directions: ("up" | "down" | "left" | "right")[] = ["up", "down", "left", "right"]
            newDirection = directions[Math.floor(Math.random() * directions.length)]
          }

          // Wrap around the map edges
          if (newX < 0) newX = gridSize.width - 1
          if (newX >= gridSize.width) newX = 0
          if (newY < 0) newY = gridSize.height - 1
          if (newY >= gridSize.height) newY = 0

          return {
            ...vehicle,
            x: newX,
            y: newY,
            direction: newDirection,
          }
        })
      })

      animationRef.current = requestAnimationFrame(updateVehicles)
    }

    animationRef.current = requestAnimationFrame(updateVehicles)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isSimulationRunning, trafficLights])

  // Render the city grid
  const renderGrid = () => {
    const cells = []

    // Render roads
    for (let x = 0; x < gridSize.width; x++) {
      for (let y = 0; y < gridSize.height; y++) {
        const isHorizontalRoad = y % 2 === 0
        const isVerticalRoad = x % 2 === 0
        const isIntersection = isHorizontalRoad && isVerticalRoad

        let cellClass = "absolute border border-gray-600"

        if (isIntersection) {
          cellClass += " bg-gray-600"
        } else if (isHorizontalRoad || isVerticalRoad) {
          cellClass += " bg-gray-700"
        } else {
          cellClass += " bg-gray-800"
        }

        cells.push(
          <div
            key={`${x}-${y}`}
            className={cellClass}
            style={{
              width: `${100 / gridSize.width}%`,
              height: `${100 / gridSize.height}%`,
              left: `${(x / gridSize.width) * 100}%`,
              top: `${(y / gridSize.height) * 100}%`,
            }}
          />,
        )
      }
    }

    return cells
  }

  // Render traffic lights
  const renderTrafficLights = () => {
    return trafficLights.map((light) => (
      <div
        key={`light-${light.id}`}
        className={`absolute rounded-full ${light.status === "red" ? "bg-red-500" : "bg-emerald-500"}`}
        style={{
          width: "10px",
          height: "10px",
          left: `calc(${(light.x / gridSize.width) * 100}% - 5px)`,
          top: `calc(${(light.y / gridSize.height) * 100}% - 5px)`,
          boxShadow: `0 0 10px ${light.status === "red" ? "#ef4444" : "#10b981"}`,
        }}
      />
    ))
  }

  // Render vehicles
  const renderVehicles = () => {
    return vehicles.map((vehicle) => {
      let vehicleColor = "bg-blue-500"

      if (vehicle.type === "emergency") {
        if (vehicle.emergencyType === "fire") vehicleColor = "bg-red-500"
        else if (vehicle.emergencyType === "medical") vehicleColor = "bg-white"
        else if (vehicle.emergencyType === "police") vehicleColor = "bg-blue-600"
      }

      return (
        <motion.div
          key={`vehicle-${vehicle.id}`}
          className={`absolute rounded-sm ${vehicleColor}`}
          style={{
            width: vehicle.type === "emergency" ? "15px" : "10px",
            height: vehicle.type === "emergency" ? "15px" : "10px",
            x: `calc(${(vehicle.x / gridSize.width) * 100}% - ${vehicle.type === "emergency" ? "7.5px" : "5px"})`,
            y: `calc(${(vehicle.y / gridSize.height) * 100}% - ${vehicle.type === "emergency" ? "7.5px" : "5px"})`,
            boxShadow: vehicle.type === "emergency" ? `0 0 15px ${vehicleColor.replace("bg-", "")}` : "none",
            zIndex: vehicle.type === "emergency" ? 20 : 10,
          }}
          animate={{
            x: `calc(${(vehicle.x / gridSize.width) * 100}% - ${vehicle.type === "emergency" ? "7.5px" : "5px"})`,
            y: `calc(${(vehicle.y / gridSize.height) * 100}% - ${vehicle.type === "emergency" ? "7.5px" : "5px"})`,
            rotate:
              vehicle.direction === "up"
                ? -90
                : vehicle.direction === "down"
                  ? 90
                  : vehicle.direction === "left"
                    ? 180
                    : 0,
          }}
          transition={{ type: "tween", duration: 0.1 }}
        />
      )
    })
  }

  // Render emergency location
  const renderEmergencyLocation = () => {
    if (!emergencyLocation) return null

    return (
      <div
        className="absolute animate-pulse rounded-full bg-red-500/50"
        style={{
          width: "30px",
          height: "30px",
          left: `calc(${(emergencyLocation.x / gridSize.width) * 100}% - 15px)`,
          top: `calc(${(emergencyLocation.y / gridSize.height) * 100}% - 15px)`,
          boxShadow: "0 0 20px #ef4444",
          zIndex: 5,
        }}
      />
    )
  }

  return (
    <div className="relative h-full w-full">
      {renderGrid()}
      {renderTrafficLights()}
      {renderVehicles()}
      {renderEmergencyLocation()}
    </div>
  )
}

export default CityMap
