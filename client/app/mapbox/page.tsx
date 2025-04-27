// components/Map.tsx
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


async function fetchColorMatchExpr(): Promise<any[] | null> {
    const { data, error } = await supabase
        .from("road_segments")
        .select("osmid, viz_color");

    if (error) {
        console.error("Supabase error:", error);
        return null;
    }

    const colorByOsm = new globalThis.Map<number, string>();
    data!.forEach(({ osmid, viz_color }) => {
        if (!colorByOsm.has(osmid)) {
        let hex = "#808080";
        if (viz_color === "lime")   hex = "#00FF00";
        if (viz_color === "orange") hex = "#FFA500";
        if (viz_color === "red")    hex = "#FF0000";
        colorByOsm.set(osmid, hex);
        }
    });

    // Build: ["match", ["id"], id1, color1, id2, color2, …, fallback]
    const expr: any[] = ["match", ["id"]];
    for (const [osmid, hex] of colorByOsm) {
        expr.push(osmid, hex);
    }
    expr.push("#808080"); // fallback

    return expr;
}


export default function Map() {
    const container = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    // Full-screen resizing
    useEffect(() => {
        const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!container.current) return;

        const map = new mapboxgl.Map({
        container:   container.current,
        style:       "mapbox://styles/mapbox/dark-v10",
        center:      [-122.4194, 37.7749],
        zoom:        12,
        });
        map.addControl(new mapboxgl.NavigationControl());

        map.on("load", () => {
        (async () => {
            // A) Add Mapbox Streets as a vector source
            map.addSource("osm-roads", {
                type: "vector",
                url:  "mapbox://mapbox.mapbox-streets-v8"
            });

            // B) Build the de-duplicated match expression
            const matchExpr = await fetchColorMatchExpr();
            if (!matchExpr) {
                console.warn("No match expression – check Supabase table");
                return;
            }

            // C) Add the colored-roads layer, matching on the feature id()
            map.addLayer({
                id:            "colored-roads",
                type:          "line",
                source:        "osm-roads",
                "source-layer": "road",
                paint: {
                    "line-color":   matchExpr as any,
                    "line-width":   2,
                    "line-opacity": 0.8
                }
            });
        })();
        });

        return () => map.remove();
    }, [size]);

    return (
        <div
        ref={container}
        style={{
            position: "absolute",
            top:      0,
            left:     0,
            width:    size.w,
            height:   size.h
        }}
        />
    );
}
