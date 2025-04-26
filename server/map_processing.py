import osmnx as ox
import random
import geopandas as gpd
import time

print(f"OSMnx version used in map_processing: {ox.__version__}")


def load_and_initialize_map(place_name="San Francisco, California, USA"):
    """
    Loads the street graph for a given place, assigns random traffic light
    phases, calculates edge states (colors), and returns the graph data.
    """
    print(f"Starting map loading for '{place_name}'...")
    start_time = time.time()

    # 1. Download Graph Data
    print("Downloading graph data...")
    try:
        # Check if we already have the graph data cached
        cache_filename = (
            f"graph_cache_{place_name.replace(', ', '_').replace(' ', '_')}.graphml"
        )
        import os

        if os.path.exists(cache_filename):
            print(f"Loading graph from cache: {cache_filename}")
            G = ox.load_graphml(cache_filename)
        else:
            G = ox.graph_from_place(place_name, network_type="drive")
            # Save for future use
            ox.save_graphml(G, filepath=cache_filename)
            print("Graph downloaded and cached.")
    except Exception as e:
        print(f"Error downloading/loading graph: {e}")
        return None

    # 2. Convert to Undirected and Add Bearings (Using OSMnx v2.x functions)
    print("Converting graph to undirected...")
    # Use the function confirmed to work in v2.0.2 environment
    G_undirected = ox.convert.to_undirected(G)

    print("Adding edge bearings...")
    # Use the correct submodule for v2.x
    G_undirected = ox.bearing.add_edge_bearings(G_undirected)
    print("Bearings added.")

    print(
        f"Graph has {G_undirected.number_of_nodes()} nodes and {G_undirected.number_of_edges()} edges."
    )

    # 3. Assign Traffic Light Phases and Calculate Edge States
    print("Assigning random traffic light phases...")
    node_phase = {node: random.choice(["NS", "EW"]) for node in G_undirected.nodes()}
    print(f"Assigned random NS/EW phases to {len(node_phase)} nodes.")

    print("Calculating edge signal groups and initial states...")
    default_signal_group = "NS"
    edges_processed = 0
    for u, v, data in G_undirected.edges(data=True):
        edges_processed += 1
        # Ensure bearing is present
        if "bearing" not in data or data["bearing"] is None:
            # Attempt recalculation if geometry exists (basic check)
            try:
                y1, x1 = G_undirected.nodes[u]["y"], G_undirected.nodes[u]["x"]
                y2, x2 = G_undirected.nodes[v]["y"], G_undirected.nodes[v]["x"]
                data["bearing"] = ox.bearing.calculate_bearing(y1, x1, y2, x2)
            except KeyError:
                data["bearing"] = None  # Mark bearing as invalid if geometry missing

        # Determine signal group
        if data.get("bearing") is not None:
            b = data["bearing"]
            is_ew_bearing = (45 <= b < 135) or (225 <= b < 315)
            data["signal_group"] = "EW" if is_ew_bearing else "NS"
        else:
            data["signal_group"] = (
                default_signal_group  # Assign default if bearing missing
            )

        # Determine green status at each end
        data["is_green_u"] = data["signal_group"] == node_phase.get(u)
        data["is_green_v"] = data["signal_group"] == node_phase.get(v)

        # Determine visualization color
        green_u = data.get("is_green_u", False)
        green_v = data.get("is_green_v", False)
        if green_u and green_v:
            data["viz_color"] = "lime"
        elif not green_u and not green_v:
            data["viz_color"] = "red"
        elif green_u or green_v:
            data["viz_color"] = "orange"
        else:
            data["viz_color"] = "gray"  # Fallback

    print(f"Finished calculating states for {edges_processed} edges.")

    # 4. Convert to GeoDataFrame for easier handling (optional but useful)
    print("Converting final graph state to GeoDataFrame...")
    try:
        # Get nodes and edges GeoDataFrames
        gdf_nodes, gdf_edges = ox.graph_to_gdfs(G_undirected, nodes=True, edges=True)
        gdf_edges = gdf_edges.reset_index()  # Make u, v, key columns
        print("GeoDataFrame created.")
    except Exception as e:
        print(f"Error converting graph to GeoDataFrame: {e}")
        return None  # Or return the graph object G_undirected itself

    end_time = time.time()
    print(
        f"Map loading and initialization complete. Time taken: {end_time - start_time:.2f} seconds."
    )

    # Return the edges GeoDataFrame which now includes the 'viz_color'
    return gdf_edges


# Example of direct execution (for testing this file)
if __name__ == "__main__":
    print("Testing map_processing module...")
    initial_map_data = load_and_initialize_map()
    if initial_map_data is not None:
        print(f"Successfully loaded map data. Number of edges: {len(initial_map_data)}")
        print("Sample data (first 5 rows):")
        print(
            initial_map_data[
                [
                    "u",
                    "v",
                    "osmid",
                    "signal_group",
                    "is_green_u",
                    "is_green_v",
                    "viz_color",
                ]
            ].head()
        )
    else:
        print("Failed to load map data.")
