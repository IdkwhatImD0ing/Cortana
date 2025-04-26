'use client';

import dynamic from 'next/dynamic';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';

const KeplerGl = dynamic(
    () => import('@kepler.gl/components').then((m) => m.default),
    { ssr: false }
);

export default function MapViewer() {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    return (
        <div style={{ position: 'absolute', inset: 0 }}>
        <AutoSizer>
            {({ width, height }) => (
            <KeplerGl
                id="map"                       // ← must match admin’s id
                width={width}
                height={height}
                mapboxApiAccessToken={token}
                initialUiState={{             // hide all side panels & modals
                readOnly:        true,
                activeSidePanel: null,
                currentModal:    null
                }}
            />
            )}
        </AutoSizer>
        </div>
    );
}
