"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { FeatureCollection, Geometry } from "geojson";

interface BaseFeatureProperties {
    [key: string]: any;
}

type TrafficFeatureCollection = FeatureCollection<Geometry, BaseFeatureProperties>;

interface RoadSegment {
    osmid: number | string;
    traffic_level?: number | null;
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
if (!mapboxgl.accessToken) {
    throw new Error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const lineColorExpression: any = [
    "match",
    ["feature-state", "traffic_level"],
    0, "#4CAF50",
    1, "#FFFF00",
    2, "#FFA500",
    3, "#800000",
    /* fallback */ "#FFFFFF",
];

export default function TrafficMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [geojson, setGeojson] = useState(null);
    const [mapData, setMapData] = useState(null);
    const isMapLoadedRef = useRef(false);
    const mapChannelRef = useRef<RealtimeChannel | null>(null);

    // Effect 1: Initialize Map, Fetch GeoJSON, Fetch Supabase, Set Initial State, Setup Listener
    useEffect(() => {
        // --- Check for necessary config ---
        if (!mapboxgl.accessToken) {
        console.error("Missing Mapbox or Supabase configuration.");
        return; 
        }

        // --- Initialize Map ---
        if (!mapContainer.current || mapRef.current) return;

        console.log("[Effect 1] Initializing map");
        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/dark-v10",
            center: [-122.4194, 37.7749], // SF Coordinates
            zoom: 12,
        });
        map.addControl(new mapboxgl.NavigationControl());
        mapRef.current = map;

        // --- Function to fetch initial Supabase data ---
        const fetchInitialSupabaseData = async (): Promise<RoadSegment[]> => {
        console.log("[Effect 1] Fetching initial Supabase data...");
        let allRows: RoadSegment[] = [];
        let from = 0;
        const pageSize = 1000; // Supabase page size limit
        let got;
        try {
            do {
            const { data, error, count } = await supabase
                .from("road_segments")
                .select("osmid, traffic_level", { count: "exact" }) // Only select needed columns
                .order("id", { ascending: true }) // Consistent ordering if needed
                .range(from, from + pageSize - 1);

            if (error) throw error;
            got = data?.length ?? 0;
            if (data) {
                allRows = allRows.concat(data as RoadSegment[]);
            }
            from += pageSize;
            // console.log(`Fetched page: ${from / pageSize}, Total expected: ${Math.ceil((count ?? 0) / pageSize)}`);
            } while (got === pageSize);
            console.log(
            `[Effect 1] Fetched ${allRows.length} initial road segments from Supabase.`
            );
            return allRows;
        } catch (error) {
            console.error(
            "[Effect 1] Error fetching initial Supabase data:",
            error
            );
            return []; // Return empty array on error
        }
        };

        // --- Function to apply Supabase state to map features ---
        const applySupabaseStateToMap = (
        supabaseData: RoadSegment[],
        currentMap: mapboxgl.Map | null
        ) => {
        if (!currentMap || !currentMap.isStyleLoaded()) {
            console.warn(
            "[Apply State] Map not ready, skipping state application."
            );
            return;
        }
        console.log(
            `[Apply State] Applying initial state for ${supabaseData.length} segments...`
        );
        try {
            supabaseData.forEach((segment) => {
            // Ensure osmid is treated as a number for the feature ID
            const featureId = Number(segment.osmid);
            if (!isNaN(featureId)) {
                currentMap.setFeatureState(
                { source: "traffic_edges", id: featureId },
                { traffic_level: Number(segment.traffic_level ?? -1) } // Use default if null/undefined
                );
            } else {
                console.warn(
                `[Apply State] Invalid osmid found in Supabase data: ${segment.osmid}`
                );
            }
            });
            console.log("[Apply State] Finished applying initial Supabase states.");
        } catch (error) {
            console.error("[Apply State] Error setting feature states:", error);
        }
        };

        // --- Map Load Event Listener ---
        map.on("load", async () => {
        console.log("[Effect 1] Map loaded event");
        isMapLoadedRef.current = true; // Mark map as loaded
        if (!mapRef.current) return; // Type guard

        let source: GeoJSONSource | undefined;

        // 1. Add Source & Layer
        try {
            console.log("[Effect 1] Adding empty source: traffic_edges");
            mapRef.current.addSource("traffic_edges", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }, // Start empty
            });
            source = mapRef.current.getSource("traffic_edges") as
            | GeoJSONSource
            | undefined;
            if (!source) throw new Error("Failed to get source after adding it.");

            console.log("[Effect 1] Adding layer: traffic_lines");
            mapRef.current.addLayer({
            id: "traffic_lines",
            type: "line",
            source: "traffic_edges",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": lineColorExpression, // Uses feature-state
                "line-width": 2,
                "line-opacity": 0.8,
            },
            });
        } catch (error) {
            console.error("[Effect 1] Error adding source/layer:", error);
            return;
        }

        // 2. Fetch, Process GeoJSON, and Set Source Data
        let processedGeoJson: TrafficFeatureCollection | null = null;
        try {
            console.log("[Effect 1] Fetching GeoJSON data...");
            const resp = await fetch("/data/sf_traffic_map.json");
            if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
            const rawGeojson = (await resp.json()) as TrafficFeatureCollection;

            console.log(
            "[Effect 1] Processing GeoJSON features (assigning IDs)..."
            );
            const processedFeatures: GeoJSON.Feature<
            GeoJSON.LineString | GeoJSON.MultiLineString,
            BaseFeatureProperties
            >[] = [];
            rawGeojson.features.forEach((originalFeature) => {
            const osmid = originalFeature.properties?.osmid;
            // Only keep necessary base properties, exclude traffic_level from original JSON
            const { traffic_level, ...baseProperties } =
                originalFeature.properties || {};

            if (Array.isArray(osmid)) {
                osmid.forEach((idStr) => {
                const newFeature = structuredClone(originalFeature);
                newFeature.id = parseInt(idStr, 10);
                newFeature.properties = baseProperties; // Assign base properties
                processedFeatures.push(newFeature);
                });
            } else if (osmid !== undefined && osmid !== null) {
                originalFeature.id =
                typeof osmid === "string" ? parseInt(osmid, 10) : osmid;
                originalFeature.properties = baseProperties; // Assign base properties
                processedFeatures.push(originalFeature);
            } else {
                originalFeature.properties = baseProperties; // Assign base properties
                processedFeatures.push(originalFeature);
            }
            });

            processedGeoJson = {
            type: "FeatureCollection",
            features: processedFeatures,
            };
            console.log("[Effect 1] GeoJSON processed.");

            console.log("[Effect 1] Setting source data...");
            source.setData(processedGeoJson); // Update the source with processed data
            console.log("[Effect 1] Source data set.");

            // Update React State (optional)
            setGeojson(processedGeoJson);
        } catch (error) {
            console.error("[Effect 1] Failed to fetch or process GeoJSON:", error);
            // Decide if we should proceed without GeoJSON
            return;
        }

        // 3. Fetch Initial Supabase Data & Apply State
        const initialSupabaseData = await fetchInitialSupabaseData();
        if (initialSupabaseData.length > 0) {
            applySupabaseStateToMap(initialSupabaseData, mapRef.current);
        }

        // 4. Fit Bounds (based on GeoJSON)
        if (processedGeoJson && processedGeoJson.features.length > 0) {
            try {
            const bounds = new mapboxgl.LngLatBounds();
            processedGeoJson.features.forEach((f) => {
                if (!f.geometry) return;
                if (f.geometry.type === "LineString") {
                (f.geometry.coordinates as [number, number][]).forEach((pt) =>
                    bounds.extend(pt)
                );
                } else if (f.geometry.type === "MultiLineString") {
                (f.geometry.coordinates as [number, number][][]).forEach((line) =>
                    line.forEach((pt) => bounds.extend(pt))
                );
                }
            });
            if (!bounds.isEmpty()) {
                console.log("[Effect 1] Fitting map to bounds (initial)...");
                mapRef.current?.fitBounds(bounds, { padding: 40, duration: 1000 });
            }
            } catch (error) {
            console.error("[Effect 1] Error fitting bounds:", error);
            }
        }
        }); // End map.on('load')

        // --- Setup Supabase Realtime Listener ---
        console.log("[Effect 1] Setting up Supabase realtime listener...");
        mapChannelRef.current = supabase
        .channel("road_segments_realtime") // Use a unique channel name
        .on<RoadSegment>(
            "postgres_changes",
            { event: "*", schema: "public", table: "road_segments" },
            (payload) => {
            console.log("Supabase change received:", payload);
            const updatedSegment = payload.new;
            if (updatedSegment && mapRef.current && isMapLoadedRef.current) {
                const featureId = Number(updatedSegment.osmid);
                const newLevel = Number(updatedSegment.traffic_level ?? -1); // Default if null
                if (!isNaN(featureId)) {
                console.log(
                    `[Realtime] Updating feature ${featureId} to level ${newLevel}`
                );
                mapRef.current.setFeatureState(
                    { source: "traffic_edges", id: featureId },
                    { traffic_level: newLevel }
                );
                } else {
                console.warn(
                    `[Realtime] Invalid osmid in payload: ${updatedSegment.osmid}`
                );
                }
            }
            }
        )
        .subscribe((status, err) => {
            // Optional: Log subscription status
            if (status === "SUBSCRIBED") {
            console.log("[Effect 1] Supabase realtime channel subscribed.");
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[Effect 1] Supabase channel error: ${status}`, err);
            }
        });

        // Cleanup function: Remove map and unsubscribe from channel
        return () => {
        console.log(
            "[Effect 1] Cleaning up: Removing map and unsubscribing from Supabase."
        );
        if (mapRef.current) {
            // Check if map is loaded before calling remove, although remove() handles it internally
            mapRef.current.remove();
            mapRef.current = null;
        }
        isMapLoadedRef.current = false;

        if (mapChannelRef.current) {
            supabase
            .removeChannel(mapChannelRef.current)
            .then(() => console.log("[Effect 1] Supabase channel removed."))
            .catch((err) =>
                console.error("[Effect 1] Error removing Supabase channel:", err)
            );
            mapChannelRef.current = null;
        }
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    // Fallback UI
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        return <div className="text-red-500 p-4">Missing Mapbox token</div>;
    }

    return (
        <div
        ref={mapContainer}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        />
    );
}
