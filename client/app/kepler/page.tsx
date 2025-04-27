"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDispatch } from "react-redux";
import { addDataToMap } from "@kepler.gl/actions";

// --- Helper: process GeoJSON into { fields, rows } for Kepler.gl ---
function processGeojsonForKepler(geojson: any) {
  if (!geojson?.features?.length) return null;

  // build schema from first feature
  const firstProps = geojson.features[0].properties || {};
  const propKeys = Object.keys(firstProps);
  const colorIndex = propKeys.indexOf("viz_color");

  // define fields
  const fields = propKeys.map((key) => {
    const sample = firstProps[key];
    let type: "integer"|"real"|"boolean"|"string" = "string";
    if (typeof sample === "number") type = Number.isInteger(sample) ? "integer" : "real";
    else if (typeof sample === "boolean") type = "boolean";
    // force viz_color to string
    return { name: key, type: key === "viz_color" ? "string" : type };
  });
  fields.push({ name: "geometry", type: "geojson" as any });

  // map features → rows
  const rows = geojson.features.map((f: any) => {
    const out: any[] = [];
    propKeys.forEach((k, i) => {
      let v = f.properties?.[k] ?? null;
      // no need to remap color names → hex if your source already has hex!
      out.push(v);
    });
    out.push(f.geometry);
    return out;
  });

  return { fields, rows };
}

// --- Helper: compute [minLng, minLat, maxLng, maxLat] for fitBounds ---
function calculateBounds(geojson: any): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  geojson.features.forEach((f: any) => {
    const coords = f.geometry.coordinates;
    // assume LineString: array of [lng, lat]
    coords.forEach(([lng, lat]: [number, number]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  });
  return [minLng, minLat, maxLng, maxLat];
}

// dynamically load the KeplerGl component
const KeplerGl = dynamic(
  () => import("@kepler.gl/components").then((m) => m.KeplerGl),
  { ssr: false, loading: () => <p>Loading map…</p> }
);

export default function Map() {
  const dispatch = useDispatch();
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // keep map full-screen
  useEffect(() => {
    const update = () =>
      setDims({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // fetch data and load into Kepler
  useEffect(() => {
    async function init() {
      const resp = await fetch("/data/edges_with_traffic_states_v2.json");
      const geojson = await resp.json();

      const processed = processGeojsonForKepler(geojson);
      if (!processed) {
        console.error("Failed to process GeoJSON for Kepler");
        return;
      }

      const [minLng, minLat, maxLng, maxLat] = calculateBounds(geojson);
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      const zoom =
        Math.log2(360 / (maxLng - minLng)) > 24
          ? 24
          : Math.log2(360 / (maxLng - minLng));

      const keplerConfig = {
        visState: {
          layers: [
            {
              id: "traffic_lines",
              type: "line",
              config: {
                dataId: "traffic_edges",
                label: "Traffic Edges",
                isVisible: true,
                colorField: { name: "viz_color", type: "string" },
                colorScale: "identity", // use hex strings directly
                columns: { geojson: "geometry" },
                visConfig: { opacity: 0.8, thickness: 2 },
              },
            },
          ],
          mapState: {
            latitude: centerLat,
            longitude: centerLng,
            zoom: zoom,
          },
        },
        mapStyle: { styleType: "dark" },
      };

      dispatch(
        addDataToMap({
          datasets: {
            info: { id: "traffic_edges", label: "Traffic Edges" },
            data: processed,
          },
          options: { centerMap: false, readOnly: false },
          config: keplerConfig,
        })
      );
    }
    init();
  }, [dispatch]);

  // require a valid Mapbox token
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  if (!token) {
    return (
      <div style={{ padding: 16, color: "red" }}>
        ⚠️ Missing Mapbox token (set NEXT_PUBLIC_MAPBOX_TOKEN)
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: dims.width,
        height: dims.height,
      }}
    >
      <KeplerGl
        id="map"
        mapboxApiAccessToken={token}
        width={dims.width}
        height={dims.height}
      />
    </div>
  );
}
