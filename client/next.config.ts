import type { NextConfig } from "next";
import type { Configuration as WebpackConfiguration, RuleSetRule } from "webpack"; // Optional: Import webpack types for better type checking

const nextConfig: NextConfig = {
  /* other existing config options can go here */

  webpack: (
    config: WebpackConfiguration, // Current webpack config
    { isServer, dev, defaultLoaders } // Context provided by Next.js
  ): WebpackConfiguration => { // Return the modified config

    // --- WASM Configuration Start ---

    // Enable experimental features for WebAssembly (required for topLevelAwait and potentially others)
    // Important: Spread existing experiments if you have others defined elsewhere
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };

    // Modify output settings to correctly handle WASM file paths
    config.output = {
        ...config.output, // Spread existing output config
        // Set the output filename for WASM modules.
        // Adjust the path prefix ('../') for server builds so it's relative
        // to the .next/server/ directory correctly.
        webassemblyModuleFilename: isServer
         ? '../static/wasm/[modulehash].wasm' // Places it in .next/static/wasm
         : 'static/wasm/[modulehash].wasm'   // Places it in .next/static/wasm (for client)
    };

    // Add a rule to handle .wasm files using asset modules
    // This ensures Webpack treats them as files to be emitted.
    config.module = config.module || {}; // Ensure module exists
    config.module.rules = config.module.rules || []; // Ensure rules array exists
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource', // Use asset modules to emit the file
    });

    // // --- Optional: Externals (Try this if the above isn't enough) ---
    // If parquet-wasm still causes issues specifically on the server-side build,
    // you might need to tell Webpack *not* to bundle its Node.js-specific parts.
    if (isServer) {
      config.externals = config.externals || []; // Ensure externals exists
      if (Array.isArray(config.externals)) {
         // This tells Webpack to leave the require('...') statement for this module alone
         // on the server, assuming Node.js can resolve it (and find the .wasm file).
         config.externals.push('parquet-wasm/node/parquet_wasm.js');
      } else {
          console.warn("Webpack 'externals' is not an array. Could not add parquet-wasm external.");
      }
    }
    // // --- End Optional Externals ---


    // --- WASM Configuration End ---


    // IMPORTANT: Always return the modified config
    return config;
  },
};

export default nextConfig;