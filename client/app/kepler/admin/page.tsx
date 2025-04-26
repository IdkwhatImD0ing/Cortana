// app/kepler/admin/page.tsx
'use client';

import dynamic from 'next/dynamic';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';

const KeplerGl = dynamic(
    () => import('@kepler.gl/components').then((m) => m.default),
    { ssr: false }
);

export default function KeplerAdmin() {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    return (
        <div style={{ position: 'absolute', inset: 0 }}>
        <AutoSizer>
            {({ width, height }) => (
            <KeplerGl
                id="map"                       // ← same id used everywhere
                width={width}
                height={height}
                mapboxApiAccessToken={token}
                // no `initialUiState` here → you get the full left‐panel, upload button, etc.
            />
            )}
        </AutoSizer>
        </div>
    );
}
