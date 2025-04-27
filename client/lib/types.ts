export interface Vehicle {
    id: number | string; // Assuming Supabase provides an id
    type: string;
    name: string;
    station_address: string | null;
    station_latitude: number;
    station_longitude: number;
    status: 'ready' | 'dispatched' | 'en route' | 'resolved';
    target_lat: number | null;
    target_lng: number | null;
}

export interface IncidentLocation {
    lat: number;
    lon: number;
}

export interface DispatchResponse {
    message: string;
    dispatched_vehicle_name: string;
    incident_location: { lat: number; lon: number };
    distance_calculated?: number | string; // Optional field from backend
}