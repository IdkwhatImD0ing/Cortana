# main.py
from fastapi import FastAPI, HTTPException, Query, Body, BackgroundTasks
import uvicorn
import pandas as pd
import geopandas as gpd
from contextlib import asynccontextmanager
import time
import asyncio  # Still needed for running DB updates in threadpool
import random
from typing import List, Set, Dict, Optional  # For type hinting

# Import map processing functions
from map_processing import (
    load_and_initialize_map,
    find_shortest_path,  # Renamed from perform_bfs
    find_nearest_edge,
    update_traffic_lights,
    simulate_traffic_flow,  # Import the traffic level update function
)

# Import Supabase client and update function
from supabase_client import (
    supabase,
    insert_map_data_to_supabase,
    update_supabase_edge_states,
)

# --- Global State ---
# Removed simulation task/running state
app_state = {
    "map_graph": None,  # NetworkX graph object (projected)
    "node_phases": None,  # Dict mapping node_id -> 'NS'/'EW'
    "map_load_status": "Not loaded",
    "db_init_status": "Not populated",
    "excluded_nodes": set(),  # Set of node IDs to NOT flip lights for
}


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
            f"Loaded successfully ({graph_obj.number_of_nodes()} nodes, {graph_obj.number_of_edges()} edges)"
        )
        print(
            f"Map data loaded into application state. Status: {app_state['map_load_status']}"
        )

        # --- Insert initial data into Supabase using the GDF ---
        db_status = insert_map_data_to_supabase(map_gdf)
        app_state["db_init_status"] = db_status
        # --- Removed background task start ---

    else:
        app_state["map_load_status"] = "Failed to load"
        app_state["db_init_status"] = "Skipped (Map loading failed)"
        print("Map data loading failed.")

    yield  # Server runs here

    # Shutdown
    print("FastAPI server shutting down...")
    # --- Removed background task cancellation ---
    # Clear state
    app_state["map_graph"] = None
    app_state["node_phases"] = None
    print("App state cleared.")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Live Map API", version="0.4.0", lifespan=lifespan
)  # Incremented version


# --- Helper function to run DB updates in background ---
async def run_db_update(updates: List[Dict]):
    """Runs the synchronous DB update function in a thread pool."""
    if updates:
        await asyncio.to_thread(update_supabase_edge_states, updates)


# --- API Endpoints ---
@app.get("/")
async def read_root():
    """Root endpoint providing basic server status."""
    return {
        "message": "Welcome to the Live Map API!",
        "map_load_status": app_state.get("map_load_status", "Unknown"),
        "db_init_status": app_state.get("db_init_status", "Unknown"),
        # "simulation_running": app_state.get("simulation_running", False), # Removed
    }


# --- New Manual Trigger Endpoints ---


@app.post("/simulation/trigger-light-update")
async def trigger_light_update(background_tasks: BackgroundTasks):
    """
    Manually triggers a random update of traffic light phases, updates
    the in-memory state, and pushes changes to Supabase in the background.
    """
    graph = app_state.get("map_graph")
    current_phases = app_state.get("node_phases")
    if graph is None or current_phases is None:
        raise HTTPException(status_code=503, detail="Map graph or phases not loaded.")

    all_nodes = list(graph.nodes())
    if not all_nodes:
        return {
            "message": "No nodes in graph to update.",
            "nodes_flipped": [],
            "db_updates_triggered": 0,
        }

    excluded = app_state.get("excluded_nodes", set())
    eligible_nodes = [node for node in all_nodes if node not in excluded]

    if not eligible_nodes:
        return {
            "message": "No eligible nodes to flip.",
            "nodes_flipped": [],
            "db_updates_triggered": 0,
        }

    # Decide how many nodes to flip
    num_to_flip = random.randint(1, max(1, len(eligible_nodes) // 50))  # e.g., up to 2%
    nodes_to_flip = random.sample(eligible_nodes, k=num_to_flip)

    # Update in-memory state (modifies graph and current_phases dict in-place)
    updated_phases, db_light_updates = update_traffic_lights(
        graph, current_phases, nodes_to_flip
    )
    app_state["node_phases"] = updated_phases  # Update state reference

    # Trigger Supabase update in the background
    if db_light_updates:
        background_tasks.add_task(run_db_update, db_light_updates)

    return {
        "message": f"Triggered light update for {len(nodes_to_flip)} nodes.",
        "nodes_flipped": nodes_to_flip,
        "db_updates_triggered": len(db_light_updates),
    }


@app.post("/simulation/trigger-traffic-update")
async def trigger_traffic_update(
    background_tasks: BackgroundTasks,
    num_paths: int = Query(
        100,
        ge=1,
        le=1000,
        description="Number of paths to simulate traffic for.",
    ),
    max_peak_level: int = Query(
        3,
        ge=1,
        le=3,
        description="Maximum peak level for traffic simulation.",
    ),
):
    """
    Manually triggers a random update of traffic levels based on probabilities,
    updates the in-memory state, and pushes changes to Supabase in the background.
    """
    graph = app_state.get("map_graph")
    if graph is None:
        raise HTTPException(status_code=503, detail="Map graph not loaded.")

    # Update in-memory state (modifies graph in-place)
    db_traffic_updates = simulate_traffic_flow(
        graph, num_paths=num_paths, max_peak_level=max_peak_level
    )

    # Trigger Supabase update in the background
    if db_traffic_updates:
        background_tasks.add_task(run_db_update, db_traffic_updates)

    return {
        "message": f"Triggered traffic level update for {num_paths} paths.",
        "db_updates_triggered": len(db_traffic_updates),
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

    # Get sample data directly from graph edge attributes
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
                        "traffic_level": data.get(
                            "traffic_level", "N/A"
                        ),  # Add traffic level
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
        # "simulation_running": app_state.get("simulation_running", False), # Removed
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


# --- Renamed /graph/bfs to /graph/shortest-path ---
@app.get("/graph/shortest-path/")
async def get_shortest_path(
    start_lat: float = Query(
        ..., description="Latitude of the starting point.", example=37.7955
    ),
    start_lon: float = Query(
        ..., description="Longitude of the starting point.", example=-122.3937
    ),
    end_lat: float = Query(
        ..., description="Latitude of the ending point.", example=37.7749
    ),
    end_lon: float = Query(
        ..., description="Longitude of the ending point.", example=-122.4194
    ),
):
    """
    Finds the shortest path between two lat/lon points using Dijkstra's algorithm,
    considering edge count and traffic level. Returns the list of node IDs in the path.
    """
    start_time = time.time()
    graph = app_state.get("map_graph")
    if graph is None:
        raise HTTPException(
            status_code=503, detail="Map graph not loaded or unavailable."
        )

    # Find nearest nodes to start and end points
    print(f"Finding nearest node for start point ({start_lat}, {start_lon})...")
    start_edge = find_nearest_edge(graph, point_lat=start_lat, point_lon=start_lon)
    if start_edge is None:
        raise HTTPException(
            status_code=404,
            detail=f"Could not find a start node near ({start_lat}, {start_lon}).",
        )
    start_node_id = start_edge[0]  # Use the 'u' node of the nearest edge

    print(f"Finding nearest node for end point ({end_lat}, {end_lon})...")
    end_edge = find_nearest_edge(graph, point_lat=end_lat, point_lon=end_lon)
    if end_edge is None:
        raise HTTPException(
            status_code=404,
            detail=f"Could not find an end node near ({end_lat}, {end_lon}).",
        )
    end_node_id = end_edge[0]  # Use the 'u' node of the nearest edge

    print(
        f"Calculating shortest path from node {start_node_id} to node {end_node_id}..."
    )

    # Perform shortest path calculation using the function from map_processing
    path_result = find_shortest_path(
        graph, start_node_id, end_node_id
    )  # Use the correct function

    if path_result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No path found between start node {start_node_id} and end node {end_node_id}.",
        )

    end_time = time.time()
    # Limit the size of the returned list to avoid huge responses
    max_nodes_return = 1000
    truncated = len(path_result) > max_nodes_return
    path_limited = path_result[:max_nodes_return]

    return {
        "start_point": {"lat": start_lat, "lon": start_lon},
        "end_point": {"lat": end_lat, "lon": end_lon},
        "start_node_used": start_node_id,
        "end_node_used": end_node_id,
        "path_nodes_count": len(path_result),
        "path_nodes_truncated": truncated,
        "path_nodes": path_limited,  # Return potentially truncated list
        "processing_time_seconds": round(end_time - start_time, 5),
    }


# --- Main Execution ---
if __name__ == "__main__":
    print("Starting Uvicorn server...")
    # Set reload=False for production or when testing background tasks reliably
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
