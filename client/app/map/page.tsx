// app/map/page.js (or your route)
"use client"; // VERY IMPORTANT: Mark this page as a Client Component

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDispatch } from "react-redux";
import { addDataToMap } from "@kepler.gl/actions";

// Import data and processor
import mapData from "./edges_with_traffic_states_v2.json"; // Adjust path
// import { processGeojsonForKepler } from '../../utils/geojsonProcessor'; // Adjust path

// --- Helper function (ensure it maps color names to hex!) ---
function processGeojsonForKepler(geojson) {
    // ... (The version that maps 'lime', 'orange', 'red' to hex codes) ...
    if (!geojson || !geojson.features || geojson.features.length === 0) return null;
    try {
        const colorMap = {'lime': '#00FF00', 'orange': '#FFA500', 'red': '#FF0000'};
        const firstFeatureProps = geojson.features[0].properties || {};
        const propKeys = Object.keys(firstFeatureProps);
        const colorPropIndex = propKeys.indexOf('viz_color');
        const fields = propKeys.map(key => {
            const value = firstFeatureProps[key];
            let type = 'string';
            if (typeof value === 'number') type = Number.isInteger(value) ? 'integer' : 'real';
            else if (typeof value === 'boolean') type = 'boolean';
            return { name: key, type: (key === 'viz_color' ? 'string' : type) };
        });
        fields.push({ name: 'geometry', type: 'geojson' });
        const rows = geojson.features.map(feature => {
            const row = [];
            for (let i = 0; i < propKeys.length; i++) {
                const key = propKeys[i];
                let value = feature.properties ? feature.properties[key] : null;
                if (i === colorPropIndex && typeof value === 'string') {
                     value = colorMap[value.toLowerCase()] || '#808080'; // Map to hex
                }
                row.push(value);
            }
            row.push(feature.geometry);
            return row;
        });
        return { fields, rows };
    } catch (error) { console.error("Error processing GeoJSON:", error); return null; }
}
// --- End Helper Function ---

// Dynamically import KeplerGl with ssr: false
const KeplerGl = dynamic(
    () => import('@kepler.gl/components').then((mod) => mod.KeplerGl),
    {
        ssr: false, // Still essential
        loading: () => <p>Loading Map...</p>
    }
);

// Define the Page component
export default function MapPage() { // Use default export for pages
    const dispatch = useDispatch();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // Effect for dimensions
    useEffect(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Effect to load data and config
    useEffect(() => {
        if (mapData) {
            const processedData = processGeojsonForKepler(mapData); // Ensure colors are hex!
            if (processedData) {
                const keplerConfig = { // Layer Configuration
                    visState: {
                        layers: [{
                            id: 'traffic_lines', type: 'line', config: {
                                dataId: 'traffic_edges_v2', label: 'Traffic Edges', isVisible: true,
                                colorField: { name: 'viz_color', type: 'string' },
                                columns: { geojson: 'geometry' },
                                visConfig: { opacity: 0.8, thickness: 2 }
                            }
                        }]
                    }
                };
                dispatch(
                    addDataToMap({
                        datasets: { info: { label: 'Traffic Edges Data', id: 'traffic_edges_v2' }, data: processedData },
                        options: { centerMap: true },
                        config: keplerConfig
                    })
                );
                console.log("Data/config dispatched (App Router)");
            }
        }
    }, [dispatch]);

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "YOUR_MAPBOX_ACCESS_TOKEN") {
        return <p>Please add your Mapbox Access Token.</p>;
    }

    return (
        // Ensure layout allows Kepler to fill space
        <div style={{ position: 'absolute', width: '100vw', height: '100vh', top: 0, left: 0 }}>
             {/* Render Kepler only when dimensions are ready */}
             {dimensions.width > 0 && dimensions.height > 0 && (
                 <KeplerGl
                    id="map"
                    mapboxApiAccessToken={MAPBOX_TOKEN}
                    width={dimensions.width}
                    height={dimensions.height}
                 />
             )}
        </div>
    );
}