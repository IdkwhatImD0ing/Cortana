'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  FileText,
  MapPin,
  Truck,
  Flame, // Keep for potential future use based on type
  Shield, // Keep for potential future use based on type
  Clock,
  ChevronRight,
  Plus, // Keep for map controls
  X, // Keep for map controls
  Menu,
  BarChart3,
  Route, // Example icon for 'en route'
  CheckCircle2, // Example icon for 'resolved'
  Send, // Icon for dispatch button
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Select component is not used for dispatch type in this version, but kept for potential future filtering
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress'; // Keep for right sidebar
import { Vehicle } from '@/lib/types'; // Assuming types are defined here

// --- Configuration ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'; // Adjust if needed

// --- Helper Functions ---

// Function to get an icon based on vehicle status
const getStatusIcon = (status: Vehicle['status']) => {
  switch (status) {
    case 'dispatched':
      return <Send className="h-4 w-4 text-orange-400" />; // Using Send icon for dispatched
    case 'en route':
      return <Route className="h-4 w-4 text-blue-400" />; // Using Route icon
    case 'resolved':
      return <CheckCircle2 className="h-4 w-4 text-green-400" />; // Using CheckCircle2
    case 'ready': // Ready vehicles aren't typically shown as 'incidents' but included for completeness
      return <Truck className="h-4 w-4 text-gray-400" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

// Function to get badge variant based on status
const getStatusBadgeVariant = (
  status: Vehicle['status']
): 'destructive' | 'default' | 'secondary' | 'outline' => {
  switch (status) {
    case 'dispatched':
      return 'default'; // Yellow/Amber background
    case 'en route':
      return 'default'; // Blue background (using default and styling with className)
    case 'resolved':
      return 'secondary'; // Green background
    default:
      return 'outline';
  }
};

// Function to get badge class names for specific colors
const getStatusBadgeClassName = (status: Vehicle['status']): string => {
  switch (status) {
    case 'dispatched':
      return 'bg-amber-900 text-amber-200 border-amber-700';
    case 'en route':
      return 'bg-blue-900 text-blue-200 border-blue-700';
    case 'resolved':
      return 'bg-green-900 text-green-200 border-green-700';
    case 'ready':
        return 'bg-gray-700 text-gray-300 border-gray-600'; // Style for ready if shown
    default:
      return 'bg-gray-800 text-gray-400 border-gray-700';
  }
};

// --- Main Component ---

export default function DispatchPage() {
  // --- State Variables ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // General API errors
  const [dispatchStatusMessage, setDispatchStatusMessage] = useState<string>(''); // For dispatch form status
  const [dispatchError, setDispatchError] = useState<string | null>(null); // For dispatch form errors

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true); // Right sidebar state
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | null>(
    null
  ); // Track selected vehicle for right sidebar

  // Dispatch Form State
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  // const [incidentType, setIncidentType] = useState<string>('fire'); // Optional: Keep if needed for backend

  // --- Data Fetching ---
  const fetchVehicles = useCallback(async () => {
    console.log('Fetching vehicles...');
    // Don't reset loading on refresh, only initial load
    // setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/vehicles`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData}`);
      }
      const data: Vehicle[] = await response.json();
      setVehicles(data);
      setError(null); // Clear previous general errors

      // Auto-select the first non-ready vehicle for the details panel if none is selected
      if (!selectedVehicleName && data.length > 0) {
        const firstActive = data.find(v => v.status !== 'ready');
        if (firstActive) {
            setSelectedVehicleName(firstActive.name);
            setDetailsOpen(true); // Ensure details panel opens
        }
      }

    } catch (err: any) {
      console.error('Failed to fetch vehicles:', err);
      setError(`Failed to load vehicles: ${err.message}`);
      setVehicles([]); // Clear vehicles on error
    } finally {
      setIsLoading(false); // Ensure loading is set to false
    }
  }, [selectedVehicleName]); // Re-run if selectedVehicleName changes (might not be needed, depends on desired behavior)

  // Initial fetch and polling
  useEffect(() => {
    setIsLoading(true); // Set loading true on initial mount
    fetchVehicles();
    // Optional: Poll for updates every 30 seconds
    const intervalId = setInterval(fetchVehicles, 30000);
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchVehicles]); // fetchVehicles is memoized

  // --- Event Handlers ---

  // Handle Dispatch Form Submission
  const handleDispatch = async (event: React.FormEvent) => {
    event.preventDefault();
    setDispatchError(null);
    setDispatchStatusMessage('');

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    // Basic Validation
    if (isNaN(latNum) || isNaN(lonNum)) {
      setDispatchError('Please enter valid numeric coordinates.');
      return;
    }
     if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
       setDispatchError('Coordinates out of valid range.');
       return;
     }

    setIsDispatching(true);
    setDispatchStatusMessage('Dispatching...');

    try {
      const response = await fetch(`${API_BASE_URL}/report/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude: latNum, longitude: lonNum }),
        // Optionally include incidentType if your backend uses it:
        // body: JSON.stringify({ latitude: latNum, longitude: lonNum, type: incidentType }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `HTTP error ${response.status}`);
      }

      setDispatchStatusMessage(result.message || 'Dispatch successful!'); // Show success message from backend
      setLatitude(''); // Clear form on success
      setLongitude('');
      await fetchVehicles(); // Refresh vehicle list
    } catch (err: any) {
      console.error('Dispatch failed:', err);
      setDispatchError(`Dispatch failed: ${err.message}`);
      setDispatchStatusMessage(''); // Clear status message on error
    } finally {
      setIsDispatching(false);
    }
  };

  // Handle selecting an incident/vehicle from the list
  const handleSelectIncident = (vehicleName: string) => {
    setSelectedVehicleName(vehicleName);
    setDetailsOpen(true); // Open the details panel when an incident is clicked
  };

  // --- Derived State ---
  // Filter vehicles to show only those that are not 'ready' (i.e., active incidents)
  const activeIncidents = vehicles.filter((v) => v.status !== 'ready');

  // Find the details for the selected vehicle
  const selectedVehicleDetails = vehicles.find(
    (v) => v.name === selectedVehicleName
  );

  // --- Render ---
  return (
    // Using the same overall structure as the provided example
    <div className="flex h-screen flex-col bg-[#0a1420] text-gray-100">
      {/* Top Navigation (Simplified for focus) */}
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
            <h1 className="text-xl font-bold text-cyan-400">Dispatch Console</h1>
          </div>
          {/* Status indicators can be added back here */}
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`absolute bottom-0 left-0 top-0 z-20 flex w-80 flex-col border-r border-gray-800 bg-[#0a1420] transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Dispatch Form Section */}
          <div className="p-4">
            <h2 className="mb-2 text-lg font-semibold text-white">
              Dispatch New Incident
            </h2>
            <form onSubmit={handleDispatch} className="space-y-3">
              {/* Optional: Incident Type Selector if needed by backend */}
              {/* <Select value={incidentType} onValueChange={setIncidentType} disabled={isDispatching}>
                  <SelectTrigger className="border-gray-700 bg-gray-800 text-gray-200">
                      <SelectValue placeholder="Incident Type" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-700 bg-gray-800 text-gray-200">
                      <SelectItem value="fire">Fire Emergency</SelectItem>
                      <SelectItem value="medical">Medical Emergency</SelectItem>
                      <SelectItem value="police">Police Emergency</SelectItem>
                  </SelectContent>
              </Select> */}

              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                  disabled={isDispatching}
                  className="border-gray-700 bg-gray-800 pl-9 text-gray-200"
                />
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                  disabled={isDispatching}
                  className="border-gray-700 bg-gray-800 pl-9 text-gray-200"
                />
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>

              {/* Dispatch Status/Error Display */}
               <div className="min-h-[1.5em] text-sm">
                    {dispatchError && <p className="text-red-400">{dispatchError}</p>}
                    {dispatchStatusMessage && <p className="text-cyan-400">{dispatchStatusMessage}</p>}
               </div>

              <Button
                type="submit"
                disabled={isDispatching}
                className="w-full bg-cyan-600 text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDispatching ? 'Dispatching...' : 'Dispatch Emergency Response'}
              </Button>
            </form>
          </div>

          <Separator className="bg-gray-800" />

          {/* Active Incidents Section */}
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Active Incidents
              </h2>
              <Badge
                variant="outline"
                className="border-cyan-800 bg-cyan-950/50 text-cyan-400"
              >
                {isLoading ? '...' : activeIncidents.length} Active
              </Badge>
            </div>

            {/* Loading/Error State for Incident List */}
            {isLoading && <p className="text-gray-400">Loading incidents...</p>}
            {error && !isLoading && <p className="text-red-400">Error: {error}</p>}
            {!isLoading && !error && activeIncidents.length === 0 && (
              <p className="text-gray-400">No active incidents.</p>
            )}

            {/* Incident List */}
            {!isLoading && !error && activeIncidents.length > 0 && (
              <ScrollArea className="flex-1 pr-1"> {/* Reduced padding-right */}
                <div className="space-y-2">
                  {activeIncidents.map((vehicle) => (
                    <div
                      key={vehicle.name} // Use vehicle name or a unique ID from DB
                      className={`cursor-pointer rounded-md border p-3 transition-colors ${
                        selectedVehicleName === vehicle.name
                          ? 'border-cyan-600 bg-cyan-950/30'
                          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                      }`}
                      onClick={() => handleSelectIncident(vehicle.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(vehicle.status)}
                           {/* Display vehicle name instead of generic 'type' */}
                          <span className="font-medium">{vehicle.name}</span>
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(vehicle.status)}
                          className={getStatusBadgeClassName(vehicle.status)}
                        >
                          {vehicle.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">
                         {/* Display target location if available */}
                        {vehicle.target_lat && vehicle.target_lng ? (
                            <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Target: {vehicle.target_lat.toFixed(4)}, {vehicle.target_lng.toFixed(4)}
                            </div>
                        ) : (
                             <div className="flex items-center gap-1 text-gray-500">
                                <MapPin className="h-3 w-3" />
                                No target assigned
                            </div>
                        )}
                        {/* Display vehicle type */}
                        <div className="mt-1 flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            Type: {vehicle.type}
                        </div>
                        {/* Add timestamp if available from DB */}
                        {/* <div className="mt-1 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                {vehicle.last_updated || 'N/A'}
                            </div>
                        </div> */}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Main Map Area (Placeholder) */}
        <main className="relative flex-1 overflow-hidden bg-[#061018]">
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
             {/* Replace with your actual Map component later */}
             <p>Map Area Placeholder</p>
             {/* Example: <CityMap vehicles={vehicles} /> */}
          </div>
          {/* Map Controls/Legend can be added back here */}
        </main>

        {/* Right Sidebar (Placeholder/Basic Structure) */}
        <div
          className={`absolute bottom-0 right-0 top-0 z-20 flex w-96 flex-col border-l border-gray-800 bg-[#0a1420] transition-transform duration-300 ${
            detailsOpen && selectedVehicleName ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedVehicleDetails ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-800 p-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedVehicleDetails.status)}
                  <h2 className="text-lg font-semibold text-white">
                    {selectedVehicleDetails.name} ({selectedVehicleDetails.type})
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400"
                  onClick={() => setDetailsOpen(false)}
                >
                  <ChevronRight className="h-5 w-5" /> {/* Should be X or ChevronLeft? */}
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {/* Display selected vehicle details here */}
                 <p>Status: {selectedVehicleDetails.status}</p>
                 <p>Station: {selectedVehicleDetails.station_address || 'N/A'} ({selectedVehicleDetails.station_latitude.toFixed(4)}, {selectedVehicleDetails.station_longitude.toFixed(4)})</p>
                 {selectedVehicleDetails.target_lat && selectedVehicleDetails.target_lng && (
                     <p>Target: ({selectedVehicleDetails.target_lat.toFixed(4)}, {selectedVehicleDetails.target_lng.toFixed(4)})</p>
                 )}
                 {/* Add AI Route Info / Logs later */}
                 <Separator className="my-4 bg-gray-800" />
                 <p className="text-gray-500">AI Route Info / Logs Placeholder</p>
              </div>
              {/* Footer button can be added back */}
            </>
          ) : (
             // Optionally show a message if no vehicle is selected
             detailsOpen && <div className="p-4 text-gray-500">Select an incident to view details.</div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar (Simplified) */}
      <footer className="border-t border-gray-800 bg-[#0a1420] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Add buttons back if needed */}
          </div>
          <div className="text-xs text-gray-400">Status: {isLoading ? 'Loading...' : error ? 'Error' : 'Online'}</div>
        </div>
      </footer>
    </div>
  );
}
