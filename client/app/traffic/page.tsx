"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@supabase/supabase-js";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
if (!mapboxgl.accessToken) {
    throw new Error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getColorExpression = (): any => [
    "match",
    ["get", "traffic_level"],
    0, "#4CAF50",
    1, "#FFC107",
    2, "#FF5722",
    3, "#F44336",
    /* fallback */ "#FFFFFF"
];

export default function TrafficMap() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        console.log("[TrafficMap] initializing map");
        if (!mapContainer.current) return;

        const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v10",
        center: [-122.4194, 37.7749],
        zoom: 12
        });

        map.addControl(new mapboxgl.NavigationControl());
        mapRef.current = map;

        map.on("load", async () => {
        console.log("[TrafficMap] map loaded — fetching GeoJSON");
        const resp = await fetch("/data/sf_traffic_map.json");
        const baseData = (await resp.json()) as GeoJSON.FeatureCollection;
        console.log("[TrafficMap] loaded GeoJSON with", baseData.features.length, "features");

        // add source and layer
        map.addSource("traffic_edges", { type: "geojson", data: baseData });
        map.addLayer({
            id: "traffic_lines",
            type: "line",
            source: "traffic_edges",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": getColorExpression(), "line-width": 2, "line-opacity": 0.8 }
        });
        console.log("[TrafficMap] source & layer added");

        // zoom to data extent
        const bounds = new mapboxgl.LngLatBounds();
        baseData.features.forEach(f => {
            if (f.geometry.type === "LineString") {
            (f.geometry.coordinates as [number, number][]).forEach(pt => bounds.extend(pt));
            }
        });
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 20 });
            console.log("[TrafficMap] fitBounds applied");
        }

        const source = map.getSource("traffic_edges") as mapboxgl.GeoJSONSource;

        // traffic update function
        const updateTraffic = async () => {
            console.log("[TrafficMap] updateTraffic: querying Supabase");
            const { data: rows, error } = await supabase
            .from("road_segments")
            .select("osmid, traffic_level");

            if (error) {
            console.error("[TrafficMap] Supabase error:", error);
            return;
            }
            console.log("[TrafficMap] fetched", rows?.length, "rows");

            // build lookup map
            const lookup = new Map<string, number>();
            rows.forEach(r => lookup.set(String(r.osmid), Number(r.traffic_level)));

            // deep-clone baseData and apply updates
            let matchedCount = 0;
            const updatedFeatures = baseData.features.map(f => {
            const osmid = f.properties?.osmid ?? f.id;
            const key = String(osmid);
            const trafficLevel = lookup.get(key);
            if (trafficLevel !== undefined) {
                matchedCount++;
                console.log(`[TrafficMap] osmid=${key} match -> traffic_level=${trafficLevel}`);
                return {
                ...f,
                properties: { ...f.properties, traffic_level: trafficLevel }
                };
            }
            return f;
            });
            console.log(`[TrafficMap] matched ${matchedCount}/${baseData.features.length} features`);

            const updatedData: GeoJSON.FeatureCollection = {
            ...baseData,
            features: updatedFeatures
            };

            // update source and repaint
            source.setData(updatedData);
            console.log("[TrafficMap] source data updated");
            map.setPaintProperty("traffic_lines", "line-color", getColorExpression());
            console.log("[TrafficMap] paint property reapplied");
        };

        // initial & periodic updates
        updateTraffic();
        const intervalMs = 10_000;
        console.log(`[TrafficMap] scheduling updates every ${intervalMs}ms`);
        const interval = setInterval(updateTraffic, intervalMs);

        map.once("remove", () => {
            clearInterval(interval);
            console.log("[TrafficMap] map removed — cleared interval");
        });
        });

        return () => {
        console.log("[TrafficMap] cleanup map");
        map.remove();
        };
    }, []);

    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        return(
            <div className="text-red-500 p-4">
                Missing Mapbox token
            </div>);
    }

    return (
        <div
            ref={mapContainer}
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
        />
    );
}
