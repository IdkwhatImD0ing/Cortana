# map_processing.py
import osmnx as ox
import random
import geopandas as gpd
import time
import networkx as nx  # Import networkx for graph algorithms like BFS
from collections import deque  # Needed for BFS queue
from typing import Tuple, Optional, Dict, List, Any
import math
import numpy as np
from shapely.geometry import LineString, Point

print(f"OSMnx version used in map_processing: {ox.__version__}")
print(f"NetworkX version used in map_processing: {nx.__version__}")


def find_nearest_edge(graph: nx.MultiGraph, point_lat: float, point_lon: float):
    """
    Finds the nearest edge (road segment) in the graph to a given lat/lon point.

    Args:
        graph: The networkx graph object (must be projected).
        point_lat: The latitude of the point.
        point_lon: The longitude of the point.

    Returns:
        A tuple (u, v, key) representing the nearest edge, where u and v are
        node IDs and key is the edge key (usually 0 for undirected graphs
        unless parallel edges exist).
        Returns None if the graph is None or empty, or if projection is missing.
    """
    if graph is None or graph.number_of_nodes() == 0:
        print("Find Nearest Edge Error: Graph is None or empty.")
        return None

    # Ensure the graph is projected for nearest_edges to work correctly
    # Check if the CRS object exists and has the is_geographic attribute
    crs = graph.graph.get("crs")
    if crs is None or (hasattr(crs, "is_geographic") and crs.is_geographic):
        print("Find Nearest Edge Error: Graph must be projected to a suitable CRS.")
        print(f"Current graph CRS: {crs}")
        return None

    try:
        # Use osmnx.nearest_edges - Note the order: Longitude (X), Latitude (Y)
        nearest_edge_result = ox.nearest_edges(
            graph, X=point_lon, Y=point_lat, return_dist=False
        )

        # Handle case where multiple edges are returned (take the first)
        if isinstance(nearest_edge_result, list):
            if not nearest_edge_result:  # Empty list if no edges found (unlikely)
                print(
                    f"Find Nearest Edge Warning: No edges found near ({point_lat}, {point_lon})."
                )
                return None
            nearest_edge = nearest_edge_result[0]
            # print(f"Multiple nearest edges found near ({point_lat}, {point_lon}), selecting first: {nearest_edge}") # Less verbose
        else:
            nearest_edge = nearest_edge_result  # Should be a tuple (u, v, key)

        # nearest_edge should be a tuple (u, v, key)
        if isinstance(nearest_edge, tuple) and len(nearest_edge) == 3:
            # print(f"Nearest edge found near ({point_lat}, {point_lon}): u={nearest_edge[0]}, v={nearest_edge[1]}, key={nearest_edge[2]}") # Less verbose
            return nearest_edge
        else:
            print(
                f"Find Nearest Edge Warning: Unexpected result format from ox.nearest_edges: {nearest_edge}"
            )
            return None

    except Exception as e:
        # Catch potential errors during the nearest edge calculation
        print(f"Find Nearest Edge Error: An exception occurred: {e}")
        return None


def perform_bfs(graph: nx.MultiGraph, start_node: int):
    """
    Performs Breadth-First Search on the graph starting from a given node.

    Args:
        graph: The networkx graph object (e.g., G_undirected).
        start_node: The ID of the node to start the BFS from.

    Returns:
        A list of node IDs visited in BFS order, or None if start_node is invalid.
        Returns an empty list if the graph is None or empty.
    """
    if graph is None or graph.number_of_nodes() == 0:
        print("BFS Error: Graph is None or empty.")
        return []  # Return empty list for empty graph

    if start_node not in graph:
        print(f"BFS Error: Start node {start_node} not found in the graph.")
        return None  # Indicate invalid start node

    visited = {start_node}  # Set to keep track of visited nodes
    queue = deque([start_node])  # Queue for BFS
    bfs_order = []  # List to store the order of visited nodes

    # print(f"Starting BFS from node {start_node}...") # Less verbose
    while queue:
        current_node = queue.popleft()
        bfs_order.append(current_node)

        # Iterate through neighbors of the current node
        for neighbor in graph.neighbors(current_node):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    # print(f"BFS finished. Visited {len(bfs_order)} nodes.") # Less verbose
    return bfs_order


def find_shortest_path(
    graph: nx.MultiGraph, start_node: int, end_node: int
) -> Optional[List[int]]:
    """
    Finds the shortest path between two nodes using Dijkstra's algorithm,
    considering edge distance (cost 1 per edge) and traffic level.

    Args:
        graph: The networkx graph object (projected).
        start_node: The ID of the starting node.
        end_node: The ID of the target node.

    Returns:
        A list of node IDs representing the shortest path from start_node to
        end_node, including both start and end nodes.
        Returns None if no path exists, or if start/end nodes are invalid.
        Returns an empty list if the graph is None or empty.
    """
    if graph is None or graph.number_of_nodes() == 0:
        print("Shortest Path Error: Graph is None or empty.")
        return []  # Return empty list for empty graph

    if start_node not in graph:
        print(f"Shortest Path Error: Start node {start_node} not found in the graph.")
        return None
    if end_node not in graph:
        print(f"Shortest Path Error: End node {end_node} not found in the graph.")
        return None
    if start_node == end_node:
        return [start_node]  # Path from a node to itself is just the node

    # --- Define the weight function ---
    # Weight = Base Cost (1 per edge) + Traffic Level Penalty
    def weight_func(u, v, data):
        # data is the edge data dictionary for the edge between u and v
        # For MultiGraphs, NetworkX handles selecting the lowest weight edge if parallel edges exist
        base_cost = 1
        traffic_level = data.get("traffic_level", 0)  # Default to 0 if missing
        # Simple additive weight: Adjust multiplier if needed for different balance
        # traffic_penalty_factor = 1.0
        # return base_cost + (traffic_penalty_factor * traffic_level)
        return (
            base_cost + traffic_level
        )  # 50/50 weighting implies equal contribution scaling

    print(f"Finding shortest path from {start_node} to {end_node} using Dijkstra...")
    try:
        # Use Dijkstra's algorithm from networkx
        # Pass the weight function directly
        shortest_path_nodes = nx.dijkstra_path(
            graph, source=start_node, target=end_node, weight=weight_func
        )
        print(f"Shortest path found with {len(shortest_path_nodes)} nodes.")
        return shortest_path_nodes
    except nx.NetworkXNoPath:
        print(
            f"Shortest Path Error: No path found between {start_node} and {end_node}."
        )
        return None  # No path exists
    except Exception as e:
        print(f"Shortest Path Error: An unexpected error occurred during Dijkstra: {e}")
        return None


# --- End Modified Function ---

def find_nearest_node(graph: nx.MultiGraph, point_lat: float, point_lon: float) -> Optional[int]:
    """
    Finds the nearest node ID in the graph to a given lat/lon point.

    MODIFIED: Explicitly projects input point before calling nearest_nodes.

    Args:
        graph: The networkx graph object (must be projected, e.g., to UTM).
        point_lat: The latitude of the point (float).
        point_lon: The longitude of the point (float, should be negative for SF).

    Returns:
        The integer ID (OSM ID) of the nearest node, or None if an error occurs.
    """
    # --- Graph Checks ---
    if graph is None or graph.number_of_nodes() == 0:
        print("Find Nearest Node Error: Graph is None or empty.")
        return None
    target_crs = graph.graph.get("crs")
    if target_crs is None or (hasattr(target_crs, "is_geographic") and target_crs.is_geographic):
        print("Find Nearest Node Error: Graph must be projected to a suitable CRS.")
        print(f"Current graph CRS: {target_crs}")
        return None

    # --- Input Coordinate Type/Value Checks ---
    # (Keep the checks from the previous version if desired, ensuring lat/lon are numbers)
    # ... (removed for brevity, but recommend keeping them) ...
    if not isinstance(point_lat, (float, int, np.number)) or not isinstance(point_lon, (float, int, np.number)):
         print("Find Nearest Node Error: Lat/Lon must be numbers.")
         return None
    if point_lon > 0 and (-123.0 < point_lon < -121.5):
         print(f"Find Nearest Node CRITICAL WARNING: Longitude {point_lon} is positive! Should be negative for SF.")
         # Consider returning None if positive lon is definitely wrong for your use case

    # --- ** NEW: Explicitly Project Input Point ** ---
    try:
        # Create a GeoSeries with the input point in Lat/Lon (EPSG:4326)
        point_geom_geo = gpd.GeoSeries([Point(float(point_lon), float(point_lat))], crs="EPSG:4326")
        # Project the point to the graph's target CRS
        point_geom_proj = point_geom_geo.to_crs(target_crs)
        # Extract the projected coordinates
        projected_x = point_geom_proj.iloc[0].x
        projected_y = point_geom_proj.iloc[0].y
        # print(f"Debug: Projected input point to X={projected_x:.3f}, Y={projected_y:.3f}") # Optional debug
    except Exception as e:
        print(f"Find Nearest Node Error: Failed to project input coordinates: {e}")
        return None

    # --- Find Nearest Node using PRE-PROJECTED Coordinates ---
    try:
        # Now call nearest_nodes with the explicitly projected X and Y
        nearest_node_id_result = ox.nearest_nodes(graph, X=projected_x, Y=projected_y)

        # Handle potential list return
        if isinstance(nearest_node_id_result, list):
            if not nearest_node_id_result:
                 print("Find Nearest Node Error: ox.nearest_nodes returned empty list.")
                 return None
            node_id = nearest_node_id_result[0]
        else:
            node_id = nearest_node_id_result

        # Final sanity check
        if node_id not in graph:
             print(f"Find Nearest Node Error: Node ID {node_id} returned by osmnx not found in graph.")
             return None

        return int(node_id)

    except Exception as e:
        print(f"Find Nearest Node Error: An exception occurred during ox.nearest_nodes call (with projected coords): {e}")
        return None

def load_and_initialize_map(
    place_name="San Francisco, California, USA",
) -> Tuple[
    Optional[nx.MultiGraph], Optional[gpd.GeoDataFrame], Optional[Dict[int, str]]
]:
    """
    Loads graph, adds bearings, projects, assigns phases, adds initial traffic level (0),
    calculates initial states, returns projected graph, Lat/Lon GDF, and initial phases.
    """
    print(f"Starting map loading for '{place_name}'...")
    start_time = time.time()
    G_proj = None
    gdf_edges = None
    initial_node_phase = None

    # 1. Download Graph Data (Utilizing OSMnx Caching)
    print(f"Requesting graph for '{place_name}'. Will use cache if available.")
    print(f"OSMnx cache folder: {ox.settings.cache_folder}")
    try:
        G = ox.graph_from_place(place_name, network_type="drive")
        # Print the number of roads in the graph
        # Count unique road IDs (osmid) to get the actual number of roads
        # Some edges might belong to the same road
        unique_road_ids = set()
        for u, v, data in G.edges(data=True):
            osmid = data.get("osmid")
            if osmid:
                # Handle both single values and lists
                if isinstance(osmid, list):
                    for road_id in osmid:
                        unique_road_ids.add(road_id)
                else:
                    unique_road_ids.add(osmid)

        print(f"Graph contains {len(unique_road_ids)} unique roads.")
        print(
            f"Graph retrieved (CRS: {G.graph.get('crs')}). Contains {G.number_of_edges()} raw edges."
        )
    except Exception as e:
        print(f"Error retrieving graph (download or cache): {e}")
        return None, None, None

    # 2. Convert to Undirected
    print("Converting graph to undirected...")
    G_undir = ox.convert.to_undirected(G)
    print(f"Graph type: {type(G_undir)}")

    # 3. Add Bearings
    print("Adding edge bearings...")
    try:
        G_undir_bearing = ox.bearing.add_edge_bearings(G_undir)
        print("Bearings added.")
    except Exception as e:
        print(f"Error adding edge bearings: {e}")
        return None, None, None

    # 4. Project the graph
    print("Projecting graph...")
    try:
        G_proj = ox.project_graph(G_undir_bearing)
        print(f"Graph projected (CRS: {G_proj.graph['crs']}).")
    except Exception as e:
        print(f"Error projecting graph: {e}")
        return None, None, None

    print(
        f"Processed graph has {G_proj.number_of_nodes()} nodes and {G_proj.number_of_edges()} edges."
    )

    G_proj = ox.convert.to_undirected(G_proj)
    print(f"Graph type: {type(G_proj)}")
    # 5. Assign Initial Traffic Light Phases and Calculate Edge States (using G_proj)
    print("Assigning initial random traffic light phases...")
    nodes_to_use = list(G_proj.nodes())
    initial_node_phase = {node: random.choice(["NS", "EW"]) for node in nodes_to_use}
    print(f"Assigned initial NS/EW phases to {len(initial_node_phase)} nodes.")

    print(
        "Calculating initial edge signal groups, light/color states, and traffic levels..."
    )
    default_signal_group = "NS"
    edges_processed = 0
    for u, v, data in G_proj.edges(data=True):
        edges_processed += 1
        # --- Calculate signal group based on bearing ---
        if "bearing" not in data or data["bearing"] is None:
            data["signal_group"] = default_signal_group
        else:
            b = data["bearing"]
            is_ew_bearing = (45 <= b < 135) or (225 <= b < 315)
            data["signal_group"] = "EW" if is_ew_bearing else "NS"

        # --- Set initial light/color state ---
        data["is_green_u"] = data["signal_group"] == initial_node_phase.get(u)
        data["is_green_v"] = data["signal_group"] == initial_node_phase.get(v)
        green_u = data.get("is_green_u", False)
        green_v = data.get("is_green_v", False)
        if green_u and green_v:
            data["viz_color"] = "lime"
        elif not green_u and not green_v:
            data["viz_color"] = "red"
        elif green_u or green_v:
            data["viz_color"] = "orange"
        else:
            data["viz_color"] = "gray"

        # --- Initialize traffic level ---
        data["traffic_level"] = 0  # Default to no traffic initially
        # --------------------------------

    print(f"Finished calculating initial states for {edges_processed} edges.")

    # 6. Convert to GeoDataFrame (from projected graph)
    print("Converting edge data to GeoDataFrame...")
    try:
        # Include traffic_level column in the GDF
        gdf_edges_proj = ox.graph_to_gdfs(G_proj, nodes=False, edges=True)
        print(
            f"Converting GeoDataFrame CRS from {gdf_edges_proj.crs} back to EPSG:4326..."
        )
        gdf_edges = gdf_edges_proj.to_crs(epsg=4326)
        print(f"GeoDataFrame CRS is now: {gdf_edges.crs}")
        gdf_edges = gdf_edges.reset_index()
        print("GeoDataFrame created.")
        # print(f"GDF columns: {gdf_edges.columns.tolist()}") # Debugging columns
    except Exception as e:
        print(f"Error converting graph edges to GeoDataFrame or reprojecting: {e}")
        return G_proj, None, initial_node_phase

    end_time = time.time()
    print(
        f"Map loading and initialization complete. Time taken: {end_time - start_time:.2f} seconds."
    )

    # --- Return projected graph, Lat/Lon GDF, and initial phases ---
    return G_proj, gdf_edges, initial_node_phase


def simulate_traffic_flow(
    graph: nx.MultiGraph,
    num_paths: int = 50,
    max_peak_level: int = 3,
    path_weight: Optional[
        str
    ] = "length",  # Use 'length' for pathfinding independent of current traffic
) -> List[Dict[str, Any]]:
    # ... (initial checks: graph None, max_peak_level) ...
    if graph is None or graph.number_of_edges() == 0:
        print("Simulate Traffic Flow Error: Graph is None or empty.")
        return []
    if max_peak_level not in [1, 2, 3]:
        print(
            "Simulate Traffic Flow Warning: max_peak_level should be 1, 2, or 3. Setting to 3."
        )
        max_peak_level = 3

    print(f"Simulating traffic flow on {num_paths} random paths...")  # Original print
    start_time = time.time()  # Original timing start

    # Store the maximum level assigned to each edge {(u, v, key): level}
    edge_max_levels: Dict[Tuple[int, int, int], int] = {
        (u, v, k): 0 for u, v, k in graph.edges(keys=True)
    }
    nodes = list(graph.nodes())
    if len(nodes) < 2:
        print("Simulate Traffic Flow Error: Not enough nodes in graph for paths.")
        return []

    # --- DEBUG COUNTERS ---
    paths_generated = 0
    paths_attempted = 0
    paths_failed_no_path = 0
    paths_failed_too_short = 0
    other_errors = 0
    # --- END DEBUG COUNTERS ---

    print(
        f"\nDEBUG: Starting simulation loop for {num_paths} paths..."
    )  # !! ADDED DEBUG PRINT !!

    for i in range(num_paths):
        paths_attempted += 1
        start_node, end_node = random.sample(nodes, 2)
        # Uncomment below for extreme detail:
        # print(f"\nDEBUG Attempt {i+1}: Path from {start_node} to {end_node} using weight='{path_weight}'")

        try:
            path_nodes = nx.shortest_path(
                graph, source=start_node, target=end_node, weight=path_weight
            )
            # Uncomment below for extreme detail:
            # print(f"  DEBUG: Found path with {len(path_nodes)} nodes.")

            if len(path_nodes) < 2:
                # print("  DEBUG: Path too short (less than 2 nodes). Skipping.")
                paths_failed_too_short += 1
                continue

            # Path is valid and long enough
            paths_generated += 1  # Increment counter

            # --- Generate the traffic pattern along the path ---
            path_edges = list(zip(path_nodes[:-1], path_nodes[1:]))
            path_edge_count = len(path_edges)
            current_path_peak_level = random.randint(1, max_peak_level)
            peak_index = path_edge_count // 2

            for idx, (u, v) in enumerate(path_edges):
                dist_from_peak = abs(idx - peak_index)
                norm_dist = dist_from_peak / (peak_index + 1e-6)
                level = current_path_peak_level * (1 - norm_dist)
                level = max(0, min(current_path_peak_level, int(round(level))))

                edge_data_dict = graph.get_edge_data(u, v)
                if edge_data_dict:
                    for key in edge_data_dict.keys():
                        edge_tuple = (u, v, key)
                        edge_max_levels[edge_tuple] = max(
                            edge_max_levels.get(edge_tuple, 0), level
                        )

        except nx.NetworkXNoPath:
            # print(f"  DEBUG: No path found between {start_node} and {end_node}.")
            paths_failed_no_path += 1
            continue
        except Exception as e:
            print(
                f"  DEBUG: Error processing path {i+1} ({start_node} -> {end_node}): {e}"
            )  # !! ADDED DEBUG PRINT !!
            other_errors += 1
            continue

    # --- After the loop ---
    # !! ADDED DEBUG PRINTS !!
    print(f"\nDEBUG: Loop finished. Stats:")
    print(f"  Paths Attempted: {paths_attempted}")
    print(f"  Paths Generated (valid length): {paths_generated}")
    print(f"  Paths Failed (No Path Exception): {paths_failed_no_path}")
    print(f"  Paths Failed (Too Short): {paths_failed_too_short}")
    print(f"  Paths Failed (Other Errors): {other_errors}")
    # !! END ADDED DEBUG PRINTS !!

    # --- Apply the calculated maximum levels back to the graph ---
    updated_edges_for_db = []
    edges_updated_count = 0
    for (u, v, k), max_level in edge_max_levels.items():
        if graph.has_edge(u, v, k):
            current_level = graph.edges[u, v, k].get("traffic_level", 0)
            if current_level != max_level:
                graph.edges[u, v, k]["traffic_level"] = max_level
                edges_updated_count += 1
                updated_edges_for_db.append(
                    {"u_node": u, "v_node": v, "traffic_level": max_level}
                )

    end_time = time.time()  # Original timing end
    # Original final prints:
    print(f"Traffic flow simulation finished in {end_time - start_time:.2f} seconds.")
    print(f"{edges_updated_count} edge instances had their traffic level changed.")

    return updated_edges_for_db


def update_traffic_lights(
    graph: nx.MultiGraph, node_phase: Dict[int, str], nodes_to_flip: List[int]
) -> Tuple[Dict[int, str], List[Dict[str, Any]]]:
    """
    Updates the traffic light phase for specified nodes and recalculates
    the state ('is_green_u', 'is_green_v', 'viz_color') for affected edges
    directly within the graph object.

    Args:
        graph: The networkx graph object (projected).
        node_phase: The current dictionary mapping node IDs to their phase ('NS' or 'EW').
        nodes_to_flip: A list of node IDs whose phases should be flipped.

    Returns:
        A tuple containing:
        - The updated node_phase dictionary.
        - A list of dictionaries, where each dictionary contains the primary keys
          ('u_node', 'v_node') and the updated state ('is_green_u',
          'is_green_v', 'viz_color') for edges whose state changed and need
          updating in the database.
    """
    if graph is None:
        return node_phase, []

    updated_edges_for_db = []
    affected_edges = (
        set()
    )  # Keep track of edges connected to flipped nodes (u, v) tuples

    # 1. Flip phases for the selected nodes
    for node_id in nodes_to_flip:
        if node_id in node_phase:
            current_phase = node_phase[node_id]
            new_phase = "EW" if current_phase == "NS" else "NS"
            node_phase[node_id] = new_phase
            # print(f"Flipped node {node_id} from {current_phase} to {new_phase}") # Verbose logging

            # Identify edges connected to this flipped node
            # graph.edges(node_id) returns iterator of edges connected to node_id
            for u, v in graph.edges(node_id):  # We only need u, v to identify the edge
                # Store edges consistently (e.g., smaller node first) to avoid duplicates if undirected
                edge_tuple = tuple(sorted((u, v)))
                affected_edges.add(edge_tuple)

    print(
        f"Flipped phases for {len(nodes_to_flip)} nodes. Affects {len(affected_edges)} unique edge segments."
    )

    # 2. Recalculate state for affected edges
    if not affected_edges:
        return node_phase, []  # No edges affected, nothing more to do

    print(f"Recalculating state for {len(affected_edges)} affected edge segments...")
    recalculated_count = 0
    for u_orig, v_orig in affected_edges:  # Iterate through unique (u,v) pairs
        # Need to get all parallel edges between u_orig and v_orig
        # graph.get_edge_data(u, v) returns a dict {key: data} for parallel edges
        edge_keys_data = graph.get_edge_data(u_orig, v_orig)
        if not edge_keys_data:
            continue  # Should not happen if edge exists

        for key, data in edge_keys_data.items():
            recalculated_count += 1
            # Recalculate green status based on potentially updated node phases
            # Important: Check signal_group exists, although it should from init
            signal_group = data.get("signal_group", "NS")  # Default if missing
            new_is_green_u = signal_group == node_phase.get(u_orig)
            new_is_green_v = signal_group == node_phase.get(v_orig)

            # Determine new visualization color
            if new_is_green_u and new_is_green_v:
                new_viz_color = "lime"
            elif not new_is_green_u and not new_is_green_v:
                new_viz_color = "red"
            elif new_is_green_u or new_is_green_v:
                new_viz_color = "orange"
            else:
                new_viz_color = "gray"  # Fallback

            # Check if the state actually changed before updating graph and adding to DB list
            state_changed = (
                data.get("is_green_u") != new_is_green_u
                or data.get("is_green_v") != new_is_green_v
                or data.get("viz_color") != new_viz_color
            )

            if state_changed:
                # --- Update the graph object in-place ---
                data["is_green_u"] = new_is_green_u
                data["is_green_v"] = new_is_green_v
                data["viz_color"] = new_viz_color
                # -----------------------------------------

                # --- Add info needed for DB update ---
                updated_edges_for_db.append(
                    {
                        "u_node": u_orig,  # Use original u, v from the edge tuple
                        "v_node": v_orig,
                        # "key": key # Key might be needed if u,v isn't unique in DB PK
                        "is_green_u": new_is_green_u,
                        "is_green_v": new_is_green_v,
                        "viz_color": new_viz_color,
                    }
                )
                # --------------------------------------

    print(
        f"Recalculated state for {recalculated_count} edge instances. {len(updated_edges_for_db)} edges require DB update."
    )
    return node_phase, updated_edges_for_db


# Example of direct execution (for testing this file)
if __name__ == "__main__":
    print("Testing map_processing module...")
    test_graph, test_gdf, test_node_phases = load_and_initialize_map()

    if test_graph is not None and test_node_phases is not None:
        print(
            f"\nSuccessfully loaded graph (Projected CRS: {test_graph.graph['crs']}). Nodes: {test_graph.number_of_nodes()}, Edges: {test_graph.number_of_edges()}"
        )
        print(f"Initial node phases generated for {len(test_node_phases)} nodes.")

        # Check if traffic level attribute exists
        has_traffic_level = False
        if test_graph.number_of_edges() > 0:
            first_edge_data = next(iter(test_graph.edges(data=True)))[
                2
            ]  # Get data dict
            if "traffic_level" in first_edge_data:
                has_traffic_level = True
        print(f"Traffic level present in graph edge data: {has_traffic_level}")

        if test_gdf is not None:
            print(
                f"Successfully created GeoDataFrame (CRS: {test_gdf.crs}). Number of edges: {len(test_gdf)}"
            )
            if "traffic_level" in test_gdf.columns:
                print("Traffic level column present in GeoDataFrame.")
                # print("Sample traffic level data:") # Less verbose
                # print(test_gdf[['osmid', 'traffic_level']].head())
            else:
                print("Warning: Traffic level column missing from GeoDataFrame.")
        else:
            print("Failed to create GeoDataFrame.")

        print("\nTesting NEW traffic flow simulation...")
        # Ensure 'length' attribute exists, otherwise pathfinding might fail or use hop count
        if not nx.get_edge_attributes(test_graph, "length"):
            print(
                "Warning: 'length' attribute missing from edges. Pathfinding might use hop count."
            )
            # Optionally add length if missing:
            # for u, v, k, data in test_graph.edges(keys=True, data=True):
            #     if 'length' not in data: data['length'] = 1 # Example: Assign default length 1
        traffic_updates_flow = simulate_traffic_flow(
            test_graph, num_paths=100, max_peak_level=3, path_weight="length"
        )
        print(
            f"{len(traffic_updates_flow)} edges marked for DB traffic level update (Flow Method)."
        )

        # --- Test update_traffic_lights ---
        print("\nTesting traffic light update...")
        all_nodes = list(test_graph.nodes())
        if len(all_nodes) > 10:
            nodes_to_flip_test = random.sample(all_nodes, k=min(len(all_nodes), 5))
            # print(f"Nodes selected to flip: {nodes_to_flip_test}") # Less verbose
            current_phases = test_node_phases.copy()
            updated_phases, db_light_updates = update_traffic_lights(
                test_graph, current_phases, nodes_to_flip_test
            )
            print(
                f"Phases updated. {len(db_light_updates)} edges marked for DB light update."
            )
            # if db_light_updates: print(db_light_updates[:min(len(db_light_updates), 3)]) # Less verbose
        else:
            print("Not enough nodes to test light flipping.")

        # --- Test Find Nearest Edge ---
        test_lat1, test_lon1 = 37.7955, -122.3937  # SF Ferry Building
        test_lat2, test_lon2 = 37.7749, -122.4194  # SF City Hall
        print(f"\nTesting find_nearest_edge for point 1 ({test_lat1}, {test_lon1})...")
        nearest1 = find_nearest_edge(test_graph, test_lat1, test_lon1)
        print(f"\nTesting find_nearest_edge for point 2 ({test_lat2}, {test_lon2})...")
        nearest2 = find_nearest_edge(test_graph, test_lat2, test_lon2)

        start_node_sp = None
        end_node_sp = None

        if nearest1:
            u1, v1, k1 = nearest1
            start_node_sp = u1  # Use one of the nodes from the nearest edge
            print(
                f"Found nearest edge 1: u={u1}, v={v1}, key={k1}. Using node {start_node_sp} as start."
            )
        else:
            print("Could not find nearest edge 1.")

        if nearest2:
            u2, v2, k2 = nearest2
            end_node_sp = u2  # Use one of the nodes from the nearest edge
            print(
                f"Found nearest edge 2: u={u2}, v={v2}, key={k2}. Using node {end_node_sp} as end."
            )
        else:
            print("Could not find nearest edge 2.")

        # --- Test find_nearest_node ---
        print("\n--- Testing find_nearest_node ---")
        # Test points (ensure correct negative longitude)
        test_coords = {
            "Fire_Station_1": (37.74525, -122.40122), # The one we debugged
            "SF Ferry Building": (37.7955, -122.3937),
            "SF City Hall": (37.7793, -122.4194), # Corrected coords
            "Invalid Coords (Pos Lon)": (37.7749, 122.4194), # Test invalid input
            "Outside SF (Oakland)": (37.8044, -122.2712)
        }

        found_nodes = {}
        for name, (lat, lon) in test_coords.items():
             print(f"\nFinding nearest node for: {name} ({lat}, {lon})")
             node_id = find_nearest_node(test_graph, lat, lon)
             if node_id is not None:
                 print(f"  -> Found Node ID: {node_id}")
                 found_nodes[name] = node_id
                 # Optional: Check if node exists and print coordinates
                 # try:
                 #    print(f"     Node Coords (proj): x={test_graph_proj.nodes[node_id]['x']:.1f}, y={test_graph_proj.nodes[node_id]['y']:.1f}")
                 # except KeyError:
                 #    print("     Node data not found (unexpected).")
             else:
                 print(f"  -> Failed to find node.")

        # --- Test find_shortest_path using found nodes ---
        start_node_key = "SF Ferry Building"
        end_node_key = "SF City Hall"

        if start_node_key in found_nodes and end_node_key in found_nodes:
            start_node_sp = found_nodes[start_node_key]
            end_node_sp = found_nodes[end_node_key]

            if start_node_sp != end_node_sp:
                print(f"\nTesting shortest path from '{start_node_key}' (Node {start_node_sp}) to '{end_node_key}' (Node {end_node_sp})...")
                shortest_path_result = find_shortest_path(
                    test_graph, start_node_sp, end_node_sp
                )
                if shortest_path_result:
                    print(f"Shortest path found with {len(shortest_path_result)} nodes.")
                else:
                    print("No shortest path found between the selected nodes.")
            else:
                print(f"\nStart and end nodes for shortest path test are the same ({start_node_sp}). Skipping.")
        else:
             print(f"\nCould not find valid start/end nodes ('{start_node_key}', '{end_node_key}') for shortest path test.")

    else:
        print("\nFailed to load map data.")
