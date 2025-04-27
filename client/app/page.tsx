"use client";

import { useState } from "react";
import {
  AlertCircle,
  FileText,
  MapPin,
  Truck,
  Flame,
  Shield,
  Clock,
  ChevronRight,
  Plus,
  X,
  Menu,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

import CityMap from "@/components/city-map";
import TrafficLightsMap from "@/components/traffic-lights-map";

export default function Dashboard() {
  const [selectedIncident, setSelectedIncident] = useState<string | null>(
    "INC-001"
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [mapType, setMapType] = useState<"city" | "traffic">("city");

  const incidents = [
    {
      id: "INC-001",
      type: "Fire",
      location: "12th and Pine Street",
      status: "Active",
      vehicle: "Firetruck #103",
      time: "3 minutes ago",
      icon: <Flame className="h-4 w-4 text-red-500" />,
    },
    {
      id: "INC-002",
      type: "Medical",
      location: "Market & 4th",
      status: "En Route",
      vehicle: "Ambulance #42",
      time: "5 minutes ago",
      icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
    },
    {
      id: "INC-003",
      type: "Police",
      location: "Embarcadero Center",
      status: "Arrived",
      vehicle: "Police Car #17",
      time: "12 minutes ago",
      icon: <Shield className="h-4 w-4 text-blue-500" />,
    },
  ];

  const selectedIncidentDetails = incidents.find(
    (inc) => inc.id === selectedIncident
  );

  return (
    <div className="flex h-screen flex-col bg-[#0a1420] text-gray-100">
      {/* Top Navigation */}
      <header className="border-b border-gray-800 bg-[#0a1420] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-cyan-400">Cortana</h1>
            <Badge
              variant="outline"
              className="ml-2 border-cyan-800 bg-cyan-950/50 text-cyan-400"
            >
              AI-Powered Emergency Traffic Command
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-md bg-gray-800/50 px-3 py-1 text-xs">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>System Online</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-gray-800/50 px-3 py-1 text-xs">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Data Sources Connected</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-gray-800/50 px-3 py-1 text-xs">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>AI Agents Active</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`absolute bottom-0 left-0 top-0 z-20 flex w-80 flex-col border-r border-gray-800 bg-[#0a1420] transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col p-4">
            <h2 className="mb-2 text-lg font-semibold text-white">
              Emergency Dispatch
            </h2>

            <div className="mb-4 space-y-3">
              <Select defaultValue="fire">
                <SelectTrigger className="border-gray-700 bg-gray-800 text-gray-200">
                  <SelectValue placeholder="Incident Type" />
                </SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-800 text-gray-200">
                  <SelectItem value="fire">Fire Emergency</SelectItem>
                  <SelectItem value="medical">Medical Emergency</SelectItem>
                  <SelectItem value="police">Police Emergency</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Input
                  placeholder="Location"
                  className="border-gray-700 bg-gray-800 pl-9 text-gray-200"
                />
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>

              <Button className="w-full bg-cyan-600 text-white hover:bg-cyan-700">
                Dispatch Emergency Response
              </Button>
            </div>

            <div className="mb-2 mt-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Active Incidents
              </h2>
              <Badge
                variant="outline"
                className="border-cyan-800 bg-cyan-950/50 text-cyan-400"
              >
                {incidents.length} Active
              </Badge>
            </div>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      selectedIncident === incident.id
                        ? 'border-cyan-600 bg-cyan-950/30'
                        : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedIncident(incident.id)
                      setDetailsOpen(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {incident.icon}
                        <span className="font-medium">{incident.type}</span>
                      </div>
                      <Badge
                        variant={
                          incident.status === 'Active'
                            ? 'destructive'
                            : incident.status === 'En Route'
                            ? 'default'
                            : 'secondary'
                        }
                        className={
                          incident.status === 'Active'
                            ? 'bg-red-900 text-red-200'
                            : incident.status === 'En Route'
                            ? 'bg-amber-900 text-amber-200'
                            : 'bg-green-900 text-green-200'
                        }
                      >
                        {incident.status}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {incident.location}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {incident.vehicle}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {incident.time}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Map Area */}
        <main className="relative flex-1 overflow-hidden bg-[#061018]">
          <div className="absolute inset-0">

            {/* Moved Toggle to Top Center */}
            <div className="absolute top-4 left-1/2 z-30 transform -translate-x-1/2">
              <div className="inline-flex overflow-hidden rounded-md bg-cyan-200">
                {/* City Map */}
                <button
                  onClick={() => setMapType("city")}
                  className={`px-4 py-2 text-sm font-semibold focus:z-10 transition-colors ${
                    mapType === "city"
                      ? "bg-cyan-700 text-white"
                      : "text-cyan-700 hover:bg-cyan-300"
                  } rounded-l-md`}
                >
                  City Map
                </button>

                {/* Traffic Lights */}
                <button
                  onClick={() => setMapType("traffic")}
                  className={`px-4 py-2 text-sm font-semibold focus:z-10 transition-colors ${
                    mapType === "traffic"
                      ? "bg-cyan-700 text-white"
                      : "text-cyan-700 hover:bg-cyan-300"
                  } rounded-r-md`}
                >
                  Traffic Lights
                </button>
              </div>
            </div>

            {mapType === "city" ? <CityMap /> : <TrafficLightsMap />}

            {/* Map Controls Overlay */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-2">
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-gray-800 text-white hover:bg-gray-700">
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-gray-800 text-white hover:bg-gray-700">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Map Legend */}
            <div className="absolute right-4 top-4 rounded-md border border-gray-800 bg-gray-900/80 p-3 backdrop-blur-sm">
            <h3 className="mb-2 text-xs font-medium">Map Legend</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <span>Fire Emergency</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                  <span>Medical Emergency</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  <span>Police Emergency</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span>Cleared Route</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <span>Traffic Congestion</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <div
          className={`absolute bottom-0 right-0 top-0 z-20 flex w-96 flex-col border-l border-gray-800 bg-[#0a1420] transition-transform duration-300 ${
            detailsOpen && selectedIncident ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {selectedIncidentDetails && (
            <>
              <div className="flex items-center justify-between border-b border-gray-800 p-4">
                <div className="flex items-center gap-2">
                  {selectedIncidentDetails.icon}
                  <h2 className="text-lg font-semibold text-white">
                    {selectedIncidentDetails.type} -{' '}
                    {selectedIncidentDetails.id}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400"
                  onClick={() => setDetailsOpen(false)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="mb-6 space-y-4">
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-gray-400">
                      Location
                    </h3>
                    <p className="text-white">
                      {selectedIncidentDetails.location}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-medium text-gray-400">
                      Status
                    </h3>
                    <Badge
                      variant={
                        selectedIncidentDetails.status === 'Active'
                          ? 'destructive'
                          : selectedIncidentDetails.status === 'En Route'
                          ? 'default'
                          : 'secondary'
                      }
                      className={
                        selectedIncidentDetails.status === 'Active'
                          ? 'bg-red-900 text-red-200'
                          : selectedIncidentDetails.status === 'En Route'
                          ? 'bg-amber-900 text-amber-200'
                          : 'bg-green-900 text-green-200'
                      }
                    >
                      {selectedIncidentDetails.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-medium text-gray-400">
                      Assigned Vehicle
                    </h3>
                    <p className="text-white">
                      {selectedIncidentDetails.vehicle}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-medium text-gray-400">
                      Reported
                    </h3>
                    <p className="text-white">{selectedIncidentDetails.time}</p>
                  </div>
                </div>

                <Separator className="my-4 bg-gray-800" />

                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-medium text-gray-400">
                    AI Route Information
                  </h3>

                  <div className="mb-4 rounded-md border border-gray-800 bg-gray-900/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm">Estimated Time of Arrival</span>
                      <span className="font-medium text-cyan-400">
                        1:42 min
                      </span>
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm">Estimated Time Saved</span>
                      <span className="font-medium text-green-400">47%</span>
                    </div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm">Distance</span>
                      <span className="font-medium">0.8 miles</span>
                    </div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm">Progress</span>
                      <span className="font-medium">68%</span>
                    </div>
                    <Progress
                      value={68}
                      className="h-1 bg-gray-700"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium text-gray-400">
                    AI Actions Log
                  </h3>

                  <div className="space-y-3">
                    <div className="rounded-md border border-gray-800 bg-gray-900/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          30 seconds ago
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        Traffic light at Pine & 10th changed to green
                      </p>
                    </div>

                    <div className="rounded-md border border-gray-800 bg-gray-900/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          45 seconds ago
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        Traffic light at Market & 4th changed to green
                      </p>
                    </div>

                    <div className="rounded-md border border-gray-800 bg-gray-900/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          1 minute ago
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        Route recalculated due to congestion on Market St
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-800 p-4">
                <Button className="w-full bg-gray-800 text-white hover:bg-gray-700">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Incident Report
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="border-t border-gray-800 bg-[#0a1420] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400"
            >
              <FileText className="mr-1 h-3 w-3" />
              View Past Incidents
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400"
            >
              <BarChart3 className="mr-1 h-3 w-3" />
              Analytics
            </Button>
          </div>

          <div className="text-xs text-gray-400">Last updated: Just now</div>
        </div>
      </footer>
    </div>
  );
}