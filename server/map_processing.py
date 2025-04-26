# map_processing.py
import osmnx as ox
import random
import geopandas as gpd
import time
import networkx as nx  # Import networkx for graph algorithms like BFS
from collections import deque  # Needed for BFS queue
from typing import Tuple, Optional, Dict, List, Any

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


def load_and_initialize_map(
    place_name="San Francisco, California, USA",
) -> Tuple[
    Optional[nx.MultiGraph], Optional[gpd.GeoDataFrame], Optional[Dict[int, str]]
]:
    """
    Loads the street graph, adds bearings, projects it, assigns random traffic
    light phases, calculates initial edge states, and returns the projected graph,
    the edges GeoDataFrame (Lat/Lon), and the initial node_phase dictionary.
    """
    print(f"Starting map loading for '{place_name}'...")
    start_time = time.time()
    G_proj = None  # Initialize graph object
    gdf_edges = None  # Initialize GeoDataFrame
    initial_node_phase = None  # Initialize node phases

    # 1. Download Graph Data
    print("Downloading graph data...")
    try:
        G = ox.graph_from_place(place_name, network_type="drive")
        print(f"Graph downloaded (CRS: {G.graph.get('crs')}).")
    except Exception as e:
        print(f"Error downloading graph: {e}")
        return None, None, None

    # 2. Convert to Undirected
    print("Converting graph to undirected...")
    G_undir = ox.convert.to_undirected(G)

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

    # 5. Assign Initial Traffic Light Phases and Calculate Edge States
    print("Assigning initial random traffic light phases...")
    nodes_to_use = list(G_proj.nodes())  # Get list of nodes
    initial_node_phase = {node: random.choice(["NS", "EW"]) for node in nodes_to_use}
    print(f"Assigned initial NS/EW phases to {len(initial_node_phase)} nodes.")

    print("Calculating initial edge signal groups and states...")
    default_signal_group = "NS"
    edges_processed = 0
    for u, v, data in G_proj.edges(data=True):
        edges_processed += 1
        # Bearing should exist now
        if "bearing" not in data or data["bearing"] is None:
            print(
                f"Warning: Bearing missing for edge ({u}, {v}) in projected graph. Assigning default signal group."
            )
            data["signal_group"] = default_signal_group
        else:
            b = data["bearing"]
            is_ew_bearing = (45 <= b < 135) or (225 <= b < 315)
            data["signal_group"] = "EW" if is_ew_bearing else "NS"

        # Determine initial green status at each end
        data["is_green_u"] = data["signal_group"] == initial_node_phase.get(u)
        data["is_green_v"] = data["signal_group"] == initial_node_phase.get(v)

        # Determine initial visualization color
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

    print(f"Finished calculating initial states for {edges_processed} edges.")

    # 6. Convert to GeoDataFrame (from projected graph)
    print("Converting edge data to GeoDataFrame...")
    try:
        gdf_edges_proj = ox.graph_to_gdfs(G_proj, nodes=False, edges=True)
        print(
            f"Converting GeoDataFrame CRS from {gdf_edges_proj.crs} back to EPSG:4326..."
        )
        gdf_edges = gdf_edges_proj.to_crs(epsg=4326)
        print(f"GeoDataFrame CRS is now: {gdf_edges.crs}")
        gdf_edges = gdf_edges.reset_index()
        print("GeoDataFrame created.")
    except Exception as e:
        print(f"Error converting graph edges to GeoDataFrame or reprojecting: {e}")
        return (
            G_proj,
            None,
            initial_node_phase,
        )  # Return graph and phases even if GDF fails

    end_time = time.time()
    print(
        f"Map loading and initialization complete. Time taken: {end_time - start_time:.2f} seconds."
    )

    # --- Return projected graph, Lat/Lon GDF, and initial phases ---
    return G_proj, gdf_edges, initial_node_phase


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
    # Note: test_graph will be projected, test_gdf will be in Lat/Lon (EPSG:4326)
    test_graph, test_gdf, test_node_phases = load_and_initialize_map()

    if test_graph is not None:
        print(
            f"\nSuccessfully loaded graph (Projected CRS: {test_graph.graph['crs']}). Nodes: {test_graph.number_of_nodes()}, Edges: {test_graph.number_of_edges()}"
        )
        # Check if bearings exist in the graph data
        has_bearing = False
        if test_graph.number_of_edges() > 0:
            first_edge_data = next(iter(test_graph.edges(data=True)))
            if "bearing" in first_edge_data[2]:
                has_bearing = True
        print(f"Bearings present in graph edge data: {has_bearing}")

        if test_gdf is not None:
            print(
                f"Successfully created GeoDataFrame (CRS: {test_gdf.crs}). Number of edges: {len(test_gdf)}"
            )
            # print("Sample GDF data (first 5 rows):") # Less verbose
            # print(test_gdf[['u', 'v', 'osmid', 'signal_group', 'is_green_u', 'is_green_v', 'viz_color']].head())
        else:
            print("Failed to create GeoDataFrame.")

        # --- Test Find Nearest Edge ---
        test_lat, test_lon = (
            37.7955,
            -122.3937,
        )  # Example coordinates (e.g., near SF Ferry Building)
        print(f"\nTesting find_nearest_edge for point ({test_lat}, {test_lon})...")
        nearest_edge_result = find_nearest_edge(test_graph, test_lat, test_lon)
        if nearest_edge_result:
            u, v, key = nearest_edge_result
            print(f"Found nearest edge: u={u}, v={v}, key={key}")
        else:
            print("Could not find nearest edge.")
        # --- End Test Find Nearest Edge ---

        # --- Test BFS ---
        if test_graph.number_of_nodes() > 0:
            # Use a node from the nearest edge result if available, otherwise default
            start_node_id = (
                nearest_edge_result[0]
                if nearest_edge_result
                else list(test_graph.nodes())[0]
            )
            print(f"\nTesting BFS starting from node: {start_node_id}")
            bfs_result = perform_bfs(test_graph, start_node_id)
            if bfs_result is not None:
                print(f"BFS visited {len(bfs_result)} nodes.")
                # print(f"First 10 nodes in BFS order: {bfs_result[:10]}") # Less verbose
            else:
                print("BFS failed (start node likely invalid).")

            # Test BFS with an invalid node
            invalid_node_id = -999999999  # Make it more distinct
            print(f"\nTesting BFS starting from invalid node: {invalid_node_id}")
            bfs_invalid_result = perform_bfs(test_graph, invalid_node_id)
            if bfs_invalid_result is None:
                print("BFS correctly returned None for invalid start node.")
            else:
                print(f"BFS unexpectedly returned: {bfs_invalid_result}")
        else:
            print("\nGraph has no nodes, skipping BFS test.")
        # --- End Test BFS ---

        # --- Test Update Traffic Lights ---
        print("\nTesting traffic light update...")
        all_nodes = list(test_graph.nodes())
        if len(all_nodes) > 10:  # Ensure enough nodes to sample
            nodes_to_flip_test = random.sample(
                all_nodes, k=min(len(all_nodes), 5)
            )  # Flip up to 5 nodes
            print(f"Nodes selected to flip: {nodes_to_flip_test}")

            # Make a copy of phases to pass to the function
            current_phases = test_node_phases.copy()
            updated_phases, db_updates = update_traffic_lights(
                test_graph, current_phases, nodes_to_flip_test
            )

            print(f"Phases updated. {len(db_updates)} edges marked for DB update.")
            if db_updates:
                print("Sample edge data for DB update:")
                print(db_updates[: min(len(db_updates), 3)])  # Print first 3 updates

            # Verify a phase actually flipped (optional check)
            if nodes_to_flip_test:
                test_node = nodes_to_flip_test[0]
                if test_node_phases[test_node] != updated_phases[test_node]:
                    print(
                        f"Verified phase flipped for node {test_node}: {test_node_phases[test_node]} -> {updated_phases[test_node]}"
                    )
                else:
                    print(f"Warning: Phase did not flip for test node {test_node}")
        else:
            print("Not enough nodes in graph to test flipping.")
        # --- End Test Update Traffic Lights ---

    else:
        print("\nFailed to load map data.")
