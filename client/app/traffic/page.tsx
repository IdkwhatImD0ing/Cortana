"use client";

import React, { useEffect, useRef, useState } from "react";
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

const lineColorExpression: any = [
  "match",
  ["feature-state", "traffic_level"],
  0,
  "#4CAF50",
  1,
  "#FFFF00",
  2,
  "#FFA500",
  3,
  "#800000",
  /* fallback */ "#FFFFFF",
];

export default function TrafficMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [geojson, setGeojson] = useState<TrafficFeatureCollection | null>(null);

  useEffect(() => {
    console.log("[TrafficMap] initializing map");
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v10",
      center: [-122.4194, 37.7749],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl());
    mapRef.current = map;

    map.on("load", async () => {
      console.log("[TrafficMap] map loaded — fetching GeoJSON");
      const resp = await fetch("/data/sf_traffic_map.json");
      const geojson = (await resp.json()) as GeoJSON.FeatureCollection<
        GeoJSON.LineString | GeoJSON.MultiLineString, // Adjust geometry types if needed
        { osmid?: string | number | string[] } // Define properties structure
      >;

      const processedFeatures: GeoJSON.Feature[] = [];

      geojson.features.forEach((originalFeature) => {
        const osmid = originalFeature.properties?.osmid;

        // Check if osmid is an array
        if (Array.isArray(osmid)) {
          // If osmid is an array, create a new feature for each id in the array
          osmid.forEach((idStr) => {
            // Create a deep copy of the original feature to avoid modifying it by reference
            // Note: structuredClone is more robust than JSON.parse(JSON.stringify(...))
            // but might not be available in all environments. Use JSON approach if needed.
            const newFeature = structuredClone(originalFeature);
            // Alternatively, for broader compatibility:
            // const newFeature = JSON.parse(JSON.stringify(originalFeature));

            // Assign the specific id from the array (parsed as integer)
            newFeature.id = parseInt(idStr, 10); // Assuming ids in the array are numeric strings

            // Add the newly created feature to our processed list
            processedFeatures.push(newFeature);
          });
        } else if (osmid !== undefined && osmid !== null) {
          // If osmid is a single string or number, process it as before
          // Assign the id directly to the original feature object
          originalFeature.id =
            typeof osmid === "string" ? parseInt(osmid, 10) : osmid;
          // Add the original feature (now with an id) to the processed list
          processedFeatures.push(originalFeature);
        } else {
          // Handle cases where osmid is missing or null, if necessary
          // Maybe assign a default ID or skip the feature
          // console.warn("Feature missing osmid:", originalFeature);
          // For now, we'll add it without an ID, Mapbox might assign one automatically
          // Or assign a temporary unique ID if required:
          // originalFeature.id = `temp_${processedFeatures.length}`;
          processedFeatures.push(originalFeature);
        }
      });

      geojson.features = processedFeatures;

      console.log(geojson);

      map.addSource("traffic_edges", { type: "geojson", data: geojson });
      map.addLayer({
        id: "traffic_lines",
        type: "line",
        source: "traffic_edges",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": lineColorExpression,
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });

      // 4. Zoom to full extent
      const bounds = new mapboxgl.LngLatBounds();
      geojson.features.forEach((f) => {
        if (f.geometry.type === "LineString") {
          (f.geometry.coordinates as [number, number][]).forEach((pt) =>
            bounds.extend(pt)
          );
        }
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 20 });

      // 5. Pre-populate feature-state with initial levels (if geojson has it)
      geojson.features.forEach((f) => {
        const lvl = Number(f.properties?.traffic_level ?? -1);
        map.setFeatureState(
          { source: "traffic_edges", id: f.id as number },
          { traffic_level: lvl }
        );
      });

      // 6. Update function to overwrite states from Supabase
      const updateTrafficState = async () => {
        try {
          const { data: rows, error } = await supabase
            .from("road_segments")
            .select("osmid, traffic_level");
          if (error) throw error;

          rows.forEach(({ osmid, traffic_level }) => {
            const id = Number(osmid);
            map.setFeatureState(
              { source: "traffic_edges", id },
              { traffic_level: Number(traffic_level) }
            );
          });
        } catch (e) {
          console.error("Supabase update error:", e);
        }
      };

      // Initial & periodic updates
      updateTrafficState();
    });

    return () => map.remove();
  }, []);

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
