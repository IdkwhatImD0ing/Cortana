"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Provider, useDispatch } from "react-redux";
import store from "@/app/store";
import { addDataToMap } from "kepler.gl/actions";

// force KeplerGl to be typed as `any` so React-19’s ref warning disappears
const KeplerGl: any = dynamic(() => import("kepler.gl"), { ssr: false });

function MapContainer() {
  const dispatch = useDispatch();
  const [size, setSize] = useState({ width: 0, height: 0 });

  // full-screen sizing
  useEffect(() => {
    const onResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // fetch & load your GeoJSON into Kepler
  useEffect(() => {
    fetch("/data/edges_with_traffic_states_v2.json")
      .then((r) => r.json())
      .then((geojson) => {
        dispatch(
          addDataToMap({
            // your dataset
            datasets: {
              info: { label: "Traffic Edges", id: "traffic_edges" },
              data: { type: "geojson", data: geojson }
            },
            // auto-center / zoom
            options: { centerMap: true, readOnly: false },
            // layer styling
            config: {
              visState: {
                layers: [
                  {
                    id: "traffic_lines",
                    type: "geojson",
                    config: {
                      dataId: "traffic_edges",
                      label: "Traffic Lines",
                      columns: { geojson: "_geojson" },
                      isVisible: true,
                      visConfig: {
                        thickness: 2,
                        colorRange: {
                          name: "Custom",
                          type: "custom",
                          category: "Custom",
                          colors: ["#00FF00", "#FFA500", "#FF0000"]
                        }
                      }
                    }
                  }
                ]
              }
            }
          })
        );
      });
  }, [dispatch]);

  return (
    <KeplerGl
      id="map"
      mapboxApiAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      width={size.width}
      height={size.height}
    />
  );
}

export default function KeplerPage() {
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div style={{ padding: 16, color: "red" }}>
        ⚠️ Missing NEXT_PUBLIC_MAPBOX_TOKEN in your .env
      </div>
    );
  }

  return (
    <Provider store={store}>
      <MapContainer />
    </Provider>
  );
}
