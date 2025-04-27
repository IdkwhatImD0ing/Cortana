"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Feature, LineString, MultiLineString } from "geojson";

interface BaseFeatureProperties {
  osmid?: number | string;
  [key: string]: any;
}

interface RoadSegment {
  osmid: number | string;
  viz_color?: string | null;
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
if (!mapboxgl.accessToken) {
  console.error(
    "CRITICAL ERROR: Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable. Mapbox map cannot load."
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const lineColorExpression: mapboxgl.Expression = [
  "match",
  ["feature-state", "viz_color"],
  "lime",
  "#00FF00",
  "orange",
  "#FFA500",
  "red",
  "#FF0000",
  /* fallback */ "#808080",
];

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    BaseFeatureProperties
  > | null>(null);
  const isMapLoadedRef = useRef(false);
  const mapChannelRef = useRef<RealtimeChannel | null>(null);

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

    // Function to fetch all road segments data from Supabase
    const fetchInitialSupabaseData = async (): Promise<RoadSegment[]> => {
      console.log("[Effect 1] Fetching initial Supabase data...");
      let allRows: RoadSegment[] = [];
      let from = 0;
      const pageSize = 1000; // Supabase page size limit
      let got;
      try {
        do {
          const { data, error, count, status } = await supabase
            .from("road_segments")
            .select("osmid, viz_color", { count: "exact" })
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);

          if (error) throw error;
          got = data?.length ?? 0;
          if (data) {
            allRows = allRows.concat(data as RoadSegment[]);
          }
          from += pageSize;
          // console.log(`Fetched page: ${from / pageSize}, Total expected: ${Math.ceil((count ?? 0) / pageSize)}`);
        } while (got === pageSize);

        return allRows;
      } catch (error) {
        console.error(
          "[Effect 1] Error fetching initial Supabase data:",
          error
        );
        return []; // Return empty array on error
      }
    };

    // Function to apply the fetched Supabase data as feature state on the map
    const applySupabaseStateToMap = (
      supabaseData: RoadSegment[],
      currentMap: mapboxgl.Map | null
    ) => {
      if (!currentMap || !currentMap.isStyleLoaded()) {
        console.warn(
          "[Apply State] Map not ready or style not loaded, skipping state application."
        );
        return;
      }
      console.log(
        `[Apply State] Applying initial state for ${supabaseData.length} segments (using strings)...`
      );

      try {
        supabaseData.forEach((segment) => {
          const featureIdInput = segment.osmid;
          let featureId: number | undefined;

          if (typeof featureIdInput === "string") {
            featureId = parseInt(featureIdInput, 10);
          } else if (typeof featureIdInput === "number") {
            featureId = featureIdInput;
          } else {
            console.warn(
              `[Apply State] Skipping segment with invalid osmid: ${featureIdInput}`
            );
            return;
          }

          if (isNaN(featureId)) {
            console.warn(
              `[Apply State] Skipping segment with NaN osmid after parsing: ${featureIdInput}`
            );
            return;
          }

          const colorState = segment.viz_color ?? "unknown"; // Match realtime logic
          currentMap.setFeatureState(
            { source: "traffic_edges", id: featureId },
            { viz_color: colorState }
          );
        });
        console.log(`[Apply State] Finished applying initial states.`);
      } catch (error) {
        console.error("[Apply State] Error setting feature states:", error);
      }
    };

    // --- Map 'load' Event Listener ---

    map.on("load", async () => {
      console.log("[Map Event] Map 'load' event fired.");
      isMapLoadedRef.current = true;
      const currentMap = mapRef.current;
      if (!currentMap) return;

      // --- 1. Add Map Source and Layer ---
      let source: GeoJSONSource | undefined;
      try {
        console.log("[Map Setup] Adding GeoJSON source: traffic_edges");
        currentMap.addSource("traffic_edges", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          promoteId: "osmid",
        });

        source = currentMap.getSource("traffic_edges") as
          | GeoJSONSource
          | undefined;
        if (!source)
          throw new Error(
            "Failed to get source 'traffic_edges' after adding it."
          );

        console.log("[Map Setup] Adding line layer: traffic_lines");
        map.addLayer({
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
        console.error("[Map Setup] Error adding source or layer:", error);
        return;
      }

      // --- 2. Fetch and Load GeoJSON Data ---
      let processedGeoJson: GeoJSON.FeatureCollection<
        GeoJSON.Geometry,
        BaseFeatureProperties
      > | null = null;
      try {
        console.log(
          "[Map Setup] Fetching GeoJSON data (sf_traffic_map.json)..."
        );
        const resp = await fetch("/data/sf_traffic_map.json");
        if (!resp.ok) {
          throw new Error(
            `HTTP error fetching GeoJSON! Status: ${resp.status} ${resp.statusText}`
          );
        }

        const rawGeojson = (await resp.json()) as BaseFeatureProperties;

        console.log(
          "[Effect 1] Processing GeoJSON features (assigning IDs)..."
        );

        const processedFeatures: GeoJSON.Feature<
          GeoJSON.LineString | GeoJSON.MultiLineString,
          BaseFeatureProperties
        >[] = [];
        rawGeojson.features.forEach((originalFeature: Feature<LineString | MultiLineString, BaseFeatureProperties>) => {
          const osmid = originalFeature.properties?.osmid;
          // Only keep necessary base properties, exclude viz_color from original JSON
          const { viz_color, ...baseProperties } =
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
      .channel("road_segments_realtime")
      .on<RoadSegment>(
        "postgres_changes",
        { event: "*", schema: "public", table: "road_segments" },
        (payload) => {
          console.log("Supabase change received:", payload);
          const updatedSegment = payload.new;
          if (updatedSegment && mapRef.current && isMapLoadedRef.current) {
            if (
              updatedSegment &&
              "osmid" in updatedSegment &&
              "viz_color" in updatedSegment &&
              mapRef.current &&
              isMapLoadedRef.current
            ) {
              const segment = updatedSegment as RoadSegment;
              const featureId = Number(segment.osmid);
              const newColorState = updatedSegment.viz_color ?? "unknown";
              if (!isNaN(featureId)) {
                console.log(`[Realtime] Updating feature ${featureId}`);
                mapRef.current.setFeatureState(
                  { source: "traffic_edges", id: featureId },
                  { viz_color: newColorState }
                );
              } else {
                console.warn(
                  `[Realtime] Invalid osmid in payload: ${segment.osmid}`
                );
              }
            }
          } else {
            console.error(
              "[Realtime] Map not ready or style not loaded, skipping state update."
            );
          }
        }
      )
      .subscribe((status, err) => {
        // Optional: Log subscription status
        if (status === "SUBSCRIBED") {
          console.log("[Effect 1] Supabase realtime channel subscribed.");
        }
        // if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        //   console.error(`[Effect 1] Supabase channel error: ${status}`, err);
        // }
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

  // --- Render Logic ---

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
