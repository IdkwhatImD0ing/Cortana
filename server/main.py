# main.py
from fastapi import FastAPI, HTTPException, Query, Body
import uvicorn
import pandas as pd
import geopandas as gpd
from contextlib import asynccontextmanager
import time
import asyncio  # For background task
import random
from typing import List, Set, Dict, Optional  # For type hinting

# Import map processing functions
from map_processing import (
    load_and_initialize_map,
    perform_bfs,
    find_nearest_edge,
    update_traffic_lights,  # Import the new function
)

# Import Supabase client and update function
from supabase_client import (
    supabase,
    insert_map_data_to_supabase,
    update_supabase_edge_states,
)

# --- Global State ---
# Store graph, phases, and control parameters
app_state = {
    "map_graph": None,  # NetworkX graph object (projected)
    "node_phases": None,  # Dict mapping node_id -> 'NS'/'EW'
    "map_load_status": "Not loaded",
    "db_init_status": "Not populated",
    "simulation_task": None,  # Holds the asyncio task handle
    "simulation_running": False,
    "excluded_nodes": set(),  # Set of node IDs to NOT flip
}


# --- Background Simulation Task ---
async def run_traffic_simulation_periodically():
    """
    Periodically selects random nodes, flips their phases, updates the
    in-memory graph state, and pushes changes to Supabase.
    """
    print("Background simulation task starting...")
    app_state["simulation_running"] = True
    while app_state["simulation_running"]:
        try:
            # 1. Wait for random interval
            wait_time = random.uniform(3.0, 6.0)
            await asyncio.sleep(wait_time)

            # 2. Check if map is loaded
            graph = app_state.get("map_graph")
            current_phases = app_state.get("node_phases")
            if graph is None or current_phases is None:
                # print("Simulation tick: Map not ready, skipping.") # Can be noisy
                continue

            # 3. Select nodes to flip
            all_nodes = list(graph.nodes())
            if not all_nodes:
                continue  # Skip if graph has no nodes

            excluded = app_state.get("excluded_nodes", set())
            eligible_nodes = [node for node in all_nodes if node not in excluded]

            if not eligible_nodes:
                # print("Simulation tick: No eligible nodes to flip, skipping.") # Can be noisy
                continue

            # Decide how many nodes to flip (e.g., a small percentage)
            num_to_flip = random.randint(
                1, max(1, len(eligible_nodes) // 50)
            )  # Flip up to 2% (adjust as needed)
            nodes_to_flip = random.sample(eligible_nodes, k=num_to_flip)

            # 4. Update in-memory state
            # print(f"Simulation tick: Flipping {len(nodes_to_flip)} nodes...") # Can be noisy
            # update_traffic_lights modifies the graph and node_phases dict in place
            # and returns the list of changes needed for the DB
            updated_phases, db_updates = update_traffic_lights(
                graph, current_phases, nodes_to_flip
            )
            # Update the state dict reference (though it was modified in-place)
            app_state["node_phases"] = updated_phases

            # 5. Push updates to Supabase
            if db_updates:
                # Run the synchronous Supabase update function in a threadpool
                # to avoid blocking the asyncio event loop
                await asyncio.to_thread(update_supabase_edge_states, db_updates)

        except asyncio.CancelledError:
            print("Background simulation task cancelled.")
            app_state["simulation_running"] = False
            break  # Exit the loop cleanly
        except Exception as e:
            print(f"Error in background simulation task: {e}")
            # Add a longer sleep after an error to prevent rapid failure loops
            await asyncio.sleep(30)

    print("Background simulation task finished.")


# --- FastAPI Lifespan Function ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("FastAPI server starting up...")
    print("Initiating map loading process...")
    app_state["map_load_status"] = "Loading..."
    # --- Capture all three return values ---
    graph_obj, map_gdf, initial_phases = load_and_initialize_map(
        place_name="San Francisco, California, USA"  # Or smaller area for testing
    )

    if graph_obj is not None and map_gdf is not None and initial_phases is not None:
        # --- Store graph and initial phases in app_state ---
        app_state["map_graph"] = graph_obj
        app_state["node_phases"] = initial_phases  # Store the initial phases
        app_state["map_load_status"] = (
            f"Loaded successfully ({graph_obj.number_of_nodes()} nodes, {len(map_gdf)} edges)"
        )
        print(
            f"Map data loaded into application state. Status: {app_state['map_load_status']}"
        )

        # --- Insert initial data into Supabase using the GDF ---
        db_status = insert_map_data_to_supabase(map_gdf)
        app_state["db_init_status"] = db_status

        # --- Start the background simulation task ---
        if app_state["db_init_status"].startswith(
            "Successfully"
        ):  # Only start if DB init worked
            print("Starting background traffic simulation...")
            app_state["simulation_task"] = asyncio.create_task(
                run_traffic_simulation_periodically()
            )
        else:
            print("Skipping background task start due to DB initialization failure.")
        # ------------------------------------------

    else:
        app_state["map_load_status"] = "Failed to load"
        app_state["db_init_status"] = "Skipped (Map loading failed)"
        print("Map data loading failed.")

    yield  # Server runs here

    # Shutdown
    print("FastAPI server shutting down...")
    # --- Stop the background task ---
    if app_state.get("simulation_task"):
        print("Stopping background simulation task...")
        app_state["simulation_running"] = False  # Signal task to stop
        app_state["simulation_task"].cancel()
        try:
            await app_state["simulation_task"]  # Wait for task to finish cancelling
        except asyncio.CancelledError:
            print("Background task successfully cancelled.")
    # ------------------------------
    # Clear state
    app_state["map_graph"] = None
    app_state["node_phases"] = None
    print("App state cleared.")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Live Map API", version="0.3.0", lifespan=lifespan
)  # Incremented version


# --- API Endpoints ---
@app.get("/")
async def read_root():
    """Root endpoint providing basic server status."""
    return {
        "message": "Welcome to the Live Map API!",
        "map_load_status": app_state.get("map_load_status", "Unknown"),
        "db_init_status": app_state.get("db_init_status", "Unknown"),
        "simulation_running": app_state.get("simulation_running", False),
    }


# --- Endpoint to manage excluded nodes ---
@app.get("/simulation/excluded_nodes", response_model=List[int])
async def get_excluded_nodes():
    """Gets the current set of nodes excluded from traffic light flips."""
    return sorted(list(app_state.get("excluded_nodes", set())))


@app.post("/simulation/excluded_nodes", response_model=List[int])
async def set_excluded_nodes(nodes: List[int] = Body(...)):
    """
    Sets the list of node IDs to exclude from traffic light flips.
    Replaces the current list.
    """
    if app_state.get("map_graph") is None:
        raise HTTPException(status_code=503, detail="Map graph not loaded yet.")

    # Optional: Validate if nodes exist in the graph
    # valid_nodes = {node for node in nodes if node in app_state["map_graph"]}
    # invalid_nodes = set(nodes) - valid_nodes
    # if invalid_nodes:
    #     print(f"Warning: Provided excluded nodes not in graph: {invalid_nodes}")

    app_state["excluded_nodes"] = set(nodes)  # Store as a set for efficient lookup
    print(f"Excluded nodes set to: {app_state['excluded_nodes']}")
    return sorted(list(app_state["excluded_nodes"]))


@app.put("/simulation/excluded_nodes/add", response_model=List[int])
async def add_excluded_nodes(nodes: List[int] = Body(...)):
    """Adds node IDs to the list of excluded nodes."""
    if app_state.get("map_graph") is None:
        raise HTTPException(status_code=503, detail="Map graph not loaded yet.")

    current_excluded = app_state.get("excluded_nodes", set())
    current_excluded.update(nodes)
    app_state["excluded_nodes"] = current_excluded
    print(f"Excluded nodes updated: {app_state['excluded_nodes']}")
    return sorted(list(app_state["excluded_nodes"]))


@app.put("/simulation/excluded_nodes/remove", response_model=List[int])
async def remove_excluded_nodes(nodes: List[int] = Body(...)):
    """Removes node IDs from the list of excluded nodes."""
    current_excluded = app_state.get("excluded_nodes", set())
    current_excluded.difference_update(nodes)  # Remove elements found in nodes
    app_state["excluded_nodes"] = current_excluded
    print(f"Excluded nodes updated: {app_state['excluded_nodes']}")
    return sorted(list(app_state["excluded_nodes"]))


# --- Existing Endpoints ---
@app.get("/map/status")
async def get_map_status():
    """Returns the current loading status and basic info about the map data."""
    graph = app_state.get("map_graph")  # Use graph for node count
    num_edges = (
        graph.number_of_edges() if graph is not None else 0
    )  # Get edge count from graph
    num_nodes = graph.number_of_nodes() if graph is not None else 0
    sample_data = []

    # Get sample data directly from graph edge attributes if GDF isn't stored/needed
    if graph is not None and graph.number_of_edges() > 0:
        try:
            count = 0
            for u, v, data in graph.edges(data=True):
                sample_data.append(
                    {
                        "u": u,
                        "v": v,
                        "osmid": data.get("osmid"),  # Get osmid if available
                        "viz_color": data.get("viz_color", "N/A"),
                    }
                )
                count += 1
                if count >= 3:
                    break
        except Exception as e:
            print(f"Warning: Error getting sample edge data from graph: {e}")
            sample_data = [{"error": "Could not retrieve sample edge data from graph"}]

    return {
        "map_load_status": app_state.get("map_load_status", "Unknown"),
        "db_init_status": app_state.get("db_init_status", "Unknown"),
        "simulation_running": app_state.get("simulation_running", False),
        "nodes_in_memory": num_nodes,
        "edges_in_memory": num_edges,
        "excluded_nodes_count": len(app_state.get("excluded_nodes", set())),
        "sample_edge_data": sample_data,
    }


@app.get("/graph/nearest-edge/")
async def get_nearest_edge(
    lat: float = Query(..., example=37.7955), lon: float = Query(..., example=-122.3937)
):
    """
    Finds the nearest graph edge (u, v, key) to a given latitude and longitude.
    Requires the graph to be loaded in memory.
    """
    start_time = time.time()
    graph = app_state.get("map_graph")
    if graph is None:
        raise HTTPException(
            status_code=503, detail="Map graph not loaded or unavailable."
        )

    nearest_edge = find_nearest_edge(graph, point_lat=lat, point_lon=lon)

    if nearest_edge is None:
        raise HTTPException(
            status_code=404,
            detail=f"Could not find a nearest edge for ({lat}, {lon}). Check coordinates or graph projection.",
        )

    u, v, key = nearest_edge
    end_time = time.time()
    return {
        "query_lat": lat,
        "query_lon": lon,
        "nearest_edge": {"u": u, "v": v, "key": key},
        "processing_time_seconds": round(end_time - start_time, 5),
    }


@app.get("/graph/bfs/")
async def run_bfs(
    start_node: Optional[int] = Query(
        None,
        description="Node ID to start BFS from. If omitted, uses first node from nearest edge to lat/lon.",
        example=65311890,
    ),
    lat: Optional[float] = Query(
        None,
        description="Latitude to find the nearest node if start_node is omitted.",
        example=37.7955,
    ),
    lon: Optional[float] = Query(
        None,
        description="Longitude to find the nearest node if start_node is omitted.",
        example=-122.3937,
    ),
):
    """
    Performs Breadth-First Search starting from a given node ID or the
    nearest node to a given lat/lon. Returns the list of visited node IDs.
    """
    start_time = time.time()
    graph = app_state.get("map_graph")
    if graph is None:
        raise HTTPException(
            status_code=503, detail="Map graph not loaded or unavailable."
        )

    actual_start_node = start_node

    # If start_node is not provided, find nearest node to lat/lon
    if actual_start_node is None:
        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="Either 'start_node' or both 'lat' and 'lon' query parameters are required.",
            )
        print(f"No start_node provided, finding nearest edge to ({lat}, {lon})...")
        nearest_edge = find_nearest_edge(graph, point_lat=lat, point_lon=lon)
        if nearest_edge is None:
            raise HTTPException(
                status_code=404,
                detail=f"Could not find a nearest edge/node for ({lat}, {lon}).",
            )
        actual_start_node = nearest_edge[0]
        print(f"Using node {actual_start_node} from nearest edge as BFS start.")

    # Perform BFS using the determined start node
    bfs_result = perform_bfs(graph, actual_start_node)

    if bfs_result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Start node {actual_start_node} not found in graph.",
        )

    end_time = time.time()
    # Limit the size of the returned list to avoid huge responses
    max_bfs_nodes_return = 1000
    truncated = len(bfs_result) > max_bfs_nodes_return
    bfs_order_limited = bfs_result[:max_bfs_nodes_return]

    return {
        "start_node_used": actual_start_node,
        "visited_nodes_count": len(bfs_result),
        "bfs_order_truncated": truncated,
        "bfs_order": bfs_order_limited,  # Return potentially truncated list
        "processing_time_seconds": round(end_time - start_time, 5),
    }


# --- Main Execution ---
if __name__ == "__main__":
    print("Starting Uvicorn server...")
    # Set reload=False for production or when testing background tasks reliably
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
