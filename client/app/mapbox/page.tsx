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

const COLOR_MATCH_EXPRESSION: any = [
    "match",
    ["get", "viz_color"],
    "lime", "#00FF00",
    "orange", "#FFA500",
    "red", "#FF0000",
    /* fallback */ "#808080"
];

export default function Map() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<mapboxgl.Map | null>(null);
    const [dims, setDims] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const onResize = () =>
        setDims({ width: window.innerWidth, height: window.innerHeight });
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!mapContainer.current) return;
        const map = new mapboxgl.Map({
        container: mapContainer.current,
        style:     "mapbox://styles/mapbox/dark-v10",
        center:    [-122.4194, 37.7749],
        zoom:      12
        });
        map.addControl(new mapboxgl.NavigationControl());
        mapRef.current = map;

        map.on("load", async () => {
        const resp = await fetch("/data/edges_with_traffic_states_v2.json");
        const geojson = await resp.json() as GeoJSON.FeatureCollection & { features: any[] };

        const { data: rows, error } = await supabase
            .from("road_segments")
            .select("id, viz_color");
        if (error) {
            console.error("Supabase error:", error);
        } else if (rows) {
            const colorById = new window.Map<number, string>();
            for (const { id, viz_color } of rows) {
            colorById.set(id, viz_color);
            }

            geojson.features.forEach(f => {
            if (f.properties) {
                const fid = f.properties.id;
                if (colorById.has(fid)) {
                    f.properties.viz_color = colorById.get(fid)!;
                }
            }
            });
        }

        map.addSource("traffic_edges", {
            type: "geojson",
            data: geojson
        });

        map.addLayer({
            id:     "traffic_lines",
            type:   "line",
            source: "traffic_edges",
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": COLOR_MATCH_EXPRESSION,
                "line-width": 2,
                "line-opacity": 0.8
            }
        });

        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach(f => {
            if (f.geometry.type === "LineString" && Array.isArray(f.geometry.coordinates)) {
                f.geometry.coordinates.forEach((pt: number[]) => {
                    if (pt.length >= 2) {
                        bounds.extend([pt[0], pt[1]]);
                    }
                });
            }
        });
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 20 });
        });

        return () => map.remove();
    }, [dims]);

    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        return(
            <div style={{ color: "red", padding: 16 }}>
                Missing Mapbox token
            </div>
        );
    }

    return (
        <div
        ref={mapContainer}
        style={{
            position: "absolute",
            top:      0,
            left:     0,
            width:    dims.width,
            height:   dims.height
        }}
        />
    );
}
