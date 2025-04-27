"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const COLOR_MATCH_EXPRESSION: any = [
    "match",
    ["get", "viz_color"],
    "lime",   "#00FF00",
    "orange", "#FFA500",
    "red",    "#FF0000",
    /* fallback */ "#808080"
];

export default function Map() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [dims, setDims] = useState({ width: 0, height: 0 });

    // keep the map full-screen
    useEffect(() => {
        const onResize = () => setDims({
        width: window.innerWidth,
        height: window.innerHeight,
        });
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!mapContainer.current) return;
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
        const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v10",   // dark theme
        center: [-122.4194, 37.7749],               // San Francisco
        zoom: 12,
        });
        map.addControl(new mapboxgl.NavigationControl());
        mapRef.current = map;

        map.on("load", async () => {
        // pull the file from public/data
        const resp = await fetch("/data/edges_with_traffic_states_v2.json");
        const geojson = await resp.json();

        map.addSource("traffic_edges", {
            type: "geojson",
            data: geojson,
        });

        map.addLayer({
            id: "traffic_lines",
            type: "line",
            source: "traffic_edges",
            layout: {
            "line-join": "round",
            "line-cap": "round",
            },
            paint: {
            "line-color": COLOR_MATCH_EXPRESSION,
            "line-width": 2,
            "line-opacity": 0.8,
            },
        });

        // optional: zoom to data
        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach((f: any) =>
            f.geometry.coordinates.forEach((seg: [number, number]) =>
            bounds.extend(seg)
            )
        );
        map.fitBounds(bounds, { padding: 20 });
        });

        return () => map.remove();
    }, [dims]);

    // token check
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
        return (
        <div style={{ padding: 16, color: "red" }}>
            ⚠️ Missing Mapbox token (set NEXT_PUBLIC_MAPBOX_TOKEN)
        </div>
        );
    }

    return (
        <div
        ref={mapContainer}
        style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: dims.width,
            height: dims.height,
        }}
        />
    );
}
