'use client';
import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import { useDispatch } from 'react-redux';

const KeplerGl = dynamic(
    () => import('@kepler.gl/components').then((m) => m.KeplerGl),
    { ssr: false, loading: () => null }
);

export default function KeplerPage() {
    const dispatch = useDispatch();

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
    return (
        <div style={{ position: 'absolute', inset: 0 }}>
        <AutoSizer>
            {({ width, height }) => (
            <KeplerGl
                id="traffic-map"
                width={width}
                height={height}
                mapboxApiAccessToken={token}
            />
            )}
        </AutoSizer>
        </div>
    );
}
