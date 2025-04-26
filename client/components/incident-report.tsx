import type React from "react"
import { FileText, Clock, Zap, Route } from "lucide-react"

interface IncidentReportProps {
  report: {
    id: number
    type: "fire" | "medical" | "police"
    location: string
    dispatchTime: string
    arrivalTime: string
    timeSaved: string
    routeCleared: string[]
  }
}

const IncidentReport: React.FC<IncidentReportProps> = ({ report }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "fire":
        return "text-red-500"
      case "medical":
        return "text-white"
      case "police":
        return "text-blue-500"
      default:
        return "text-gray-500"
    }
  }

  const getTypeBg = (type: string) => {
    switch (type) {
      case "fire":
        return "bg-red-700/40 border-red-700"
      case "medical":
        return "bg-gray-600 border-gray-500"
      case "police":
        return "bg-blue-700/40 border-blue-700"
      default:
        return "bg-gray-600 border-gray-500"
    }
  }

  return (
    <div className={`rounded-md border p-3 ${getTypeBg(report.type)}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center">
          <FileText className={`mr-2 h-4 w-4 ${getTypeColor(report.type)}`} />
          <h4 className="font-medium">{report.type.charAt(0).toUpperCase() + report.type.slice(1)} Emergency</h4>
        </div>
        <span className="text-xs text-white">{report.dispatchTime}</span>
      </div>

      <div className="mb-3 space-y-1 text-sm">
        <div className="flex items-center text-white">
          <span className="mr-2 w-24 text-gray-200">Location:</span>
          {report.location}
        </div>
        <div className="flex items-center text-white">
          <span className="mr-2 w-24 text-gray-400">Arrival Time:</span>
          <Clock className="mr-1 h-3 w-3 text-gray-300" />
          {report.arrivalTime}
        </div>
        <div className="flex items-center text-green-500">
          <span className="mr-2 w-24 text-gray-400">Time Saved:</span>
          <Zap className="mr-1 h-3 w-3" />
          {report.timeSaved}
        </div>
      </div>

      <div className="rounded-md bg-gray-700 p-2 text-xs">
        <div className="mb-1 flex items-center">
          <Route className="mr-1 h-3 w-3 text-gray-300" />
          <span className="text-white">Route cleared:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {report.routeCleared.map((street, index) => (
            <span key={index} className="rounded-full bg-gray-600 px-2 py-0.5 text-white">
              {street}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default IncidentReport
