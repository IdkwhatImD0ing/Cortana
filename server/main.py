from fastapi import FastAPI, HTTPException
import uvicorn
import pandas as pd
import geopandas as gpd  # GeoDataFrame is used
from contextlib import asynccontextmanager

# Import map processing function
from map_processing import load_and_initialize_map

# Import Supabase client and insert function from the new file
from supabase_client import supabase, insert_map_data_to_supabase

# --- Global State ---
# Keep app state minimal, focused on application logic status
app_state = {
    "map_data_gdf": None,  # Still useful to keep the GDF in memory if needed elsewhere
    "map_load_status": "Not loaded",
    "db_init_status": "Not populated",  # Renamed for clarity
}


# --- FastAPI Lifespan Function ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("FastAPI server starting up...")
    print("Initiating map loading process...")
    app_state["map_load_status"] = "Loading..."
    map_gdf = load_and_initialize_map(
        place_name="San Francisco, California, USA"
    )  # Or smaller area for testing

    if map_gdf is not None and isinstance(map_gdf, (pd.DataFrame, gpd.GeoDataFrame)):
        app_state["map_data_gdf"] = map_gdf  # Store GDF in memory if needed
        app_state["map_load_status"] = f"Loaded successfully ({len(map_gdf)} edges)"
        print(
            f"Map data loaded into application state. Status: {app_state['map_load_status']}"
        )

        # --- Insert data into Supabase using the imported function ---
        # The function now returns the status directly
        db_status = insert_map_data_to_supabase(map_gdf)
        app_state["db_init_status"] = db_status  # Update state with returned status
        # ----------------------------------------------------------

    else:
        app_state["map_load_status"] = "Failed to load"
        app_state["db_init_status"] = "Skipped (Map loading failed)"
        print("Map data loading failed.")

    yield

    # Shutdown
    print("Shutting down...")
    # Add any cleanup logic here if needed


# --- FastAPI App Initialization ---
# Note: Supabase client is now managed in supabase_client.py
app = FastAPI(
    title="Live Map API", version="0.1.2", lifespan=lifespan
)  # Incremented version


# --- API Endpoints ---
@app.get("/")
async def read_root():
    """Root endpoint providing basic server status."""
    return {
        "message": "Welcome to the Live Map API!",
        "map_load_status": app_state.get("map_load_status", "Unknown"),
        "db_init_status": app_state.get("db_init_status", "Unknown"),
    }


@app.get("/map/status")
async def get_map_status():
    """Returns the current loading status and basic info about the map data."""
    gdf = app_state.get("map_data_gdf")
    num_edges = len(gdf) if gdf is not None else 0
    sample_data = []

    if gdf is not None:
        # Sample data conversion needs care with NaN/None for JSON
        try:
            sample_df = gdf[["u", "v", "osmid", "viz_color"]].head(3).copy()
            sample_df = sample_df.astype(object).where(
                pd.notnull(sample_df), None
            )  # Replace NaN/NaT with None
            sample_data = sample_df.to_dict(orient="records")
        except KeyError as e:
            print(f"Warning: Could not get sample data, missing column: {e}")
            sample_data = [{"error": f"Could not retrieve sample, missing column: {e}"}]
        except Exception as e:
            print(f"Warning: Error getting sample data: {e}")
            sample_data = [{"error": "Could not retrieve sample data"}]

    return {
        "map_load_status": app_state.get("map_load_status", "Unknown"),
        "db_init_status": app_state.get("db_init_status", "Unknown"),
        "number_of_edges_in_memory": num_edges,  # Clarify this is in-memory count
        "sample_edge_data": sample_data,
    }


# --- Main Execution ---
if __name__ == "__main__":
    print("Starting Uvicorn server...")
    # Set reload=False when running the population step to avoid doing it twice.
    # Turn reload=True back on for endpoint/simulation development later.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
