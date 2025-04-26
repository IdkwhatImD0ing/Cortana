import os
import math
import time
import pandas as pd
import geopandas as gpd
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Dict, Any  # Added typing

# Load environment variables from .env file
load_dotenv()

# --- Supabase Client Initialization ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = None  # Initialize as None

if not url or not key:
    print("Warning: SUPABASE_URL and/or SUPABASE_KEY environment variables not found.")
    print("Supabase client not initialized. Database operations will be skipped.")
else:
    try:
        supabase: Client = create_client(url, key)
        print("Supabase client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        # supabase remains None


# --- Database Helper Function (Initial Insert) ---
def insert_map_data_to_supabase(gdf: gpd.GeoDataFrame) -> str:
    """
    Prepares and inserts initial map data from GeoDataFrame into Supabase.
    Clears the table before insertion.

    Args:
        gdf: GeoDataFrame containing the map edge data.

    Returns:
        A string indicating the status of the database operation.
    """
    if supabase is None:
        status = "Skipped (Supabase client not initialized)"
        print(status)
        return status

    print("Preparing data for Supabase insertion...")
    # Select and rename columns to match the 'road_segments' table
    required_cols = {
        "u": "u_node",
        "v": "v_node",
        "is_green_u": "is_green_u",
        "is_green_v": "is_green_v",
        "viz_color": "viz_color",
        "osmid": "osmid",
        "bearing": "bearing",
        "length": "length",
        "signal_group": "signal_group",
    }
    cols_to_select = list(required_cols.keys())
    missing_cols = [col for col in cols_to_select if col not in gdf.columns]
    if missing_cols:
        status = f"Failed (Missing columns: {missing_cols})"
        print(f"Error: Missing required columns in GeoDataFrame: {missing_cols}")
        return status

    # Make a copy to avoid modifying the original DataFrame passed to the function
    df_for_db = gdf[cols_to_select].copy().rename(columns=required_cols)

    # Handle list-type 'osmid' values
    if "osmid" in df_for_db.columns:
        # print("Processing 'osmid' column for potential lists...") # Less verbose
        def clean_osmid(x):
            if isinstance(x, list):
                return x[0] if x else None
            return x

        df_for_db["osmid"] = df_for_db["osmid"].apply(clean_osmid)
        df_for_db["osmid"] = pd.to_numeric(df_for_db["osmid"], errors="coerce")
        # print("'osmid' column processed.")

    # Convert NaN/NaT values to None
    # print("Converting NaN/NaT values to None...") # Less verbose
    for col in df_for_db.columns:
        df_for_db[col] = (
            df_for_db[col].astype(object).where(df_for_db[col].notna(), None)
        )
    # print("NaN/NaT conversion complete.")

    # Convert DataFrame to list of dictionaries
    # print("Converting DataFrame to list of dictionaries...") # Less verbose
    data_to_insert = df_for_db.to_dict(orient="records")
    # print("Conversion complete.")

    if not data_to_insert:
        status = "No data to insert"
        print(status)
        return status

    print(f"Prepared {len(data_to_insert)} records for initial insertion.")
    status = "Pending"

    try:
        # 1. Clear existing data
        print("Clearing existing data in 'road_segments' table...")
        delete_response = (
            supabase.table("road_segments").delete().neq("id", -1).execute()
        )
        print(f"Delete response: {delete_response}")
        if hasattr(delete_response, "error") and delete_response.error:
            raise Exception(f"Error deleting data: {delete_response.error}")
        elif not (
            hasattr(delete_response, "data") or hasattr(delete_response, "count")
        ):
            print(
                f"Warning: Delete response structure unexpected or indicates no action: {delete_response}"
            )

        # 2. Insert data in batches
        batch_size = 500
        total_inserted = 0
        num_batches = math.ceil(len(data_to_insert) / batch_size)
        print(f"Inserting data in {num_batches} batches of size {batch_size}...")
        # ... (batch insertion loop as before) ...
        for i in range(0, len(data_to_insert), batch_size):
            batch_start_time = time.time()
            batch = data_to_insert[i : i + batch_size]
            current_batch_num = i // batch_size + 1
            # print(f"Inserting batch {current_batch_num}/{num_batches} ({len(batch)} records)...") # Less verbose

            insert_response = supabase.table("road_segments").insert(batch).execute()

            if hasattr(insert_response, "error") and insert_response.error:
                print(
                    f"  Error inserting batch {current_batch_num}. Response: {insert_response}"
                )
                error_details = getattr(
                    insert_response.error, "message", str(insert_response.error)
                )
                raise Exception(f"Error during batch insertion: {error_details}")
            elif hasattr(insert_response, "data") and insert_response.data is not None:
                inserted_count = len(insert_response.data)
                total_inserted += inserted_count
                batch_end_time = time.time()
                # print(f"  Batch {current_batch_num} successful ({inserted_count} records). Time: {batch_end_time - batch_start_time:.2f}s") # Less verbose
            else:
                print(
                    f"  Warning: Unexpected response structure or empty data for batch {current_batch_num}. Response: {insert_response}"
                )

        status = f"Successfully inserted {total_inserted} records."
        print(f"Database initial population complete. Status: {status}")

    except Exception as e:
        status = f"Failed ({type(e).__name__}: {e})"
        print(f"Error during Supabase initial insert operation: {e}")

    return status


# --- New Function for Updating Edge States ---
def update_supabase_edge_states(updates: List[Dict[str, Any]]):
    """
    Updates existing rows in the 'road_segments' table based on the provided updates.

    Args:
        updates: A list of dictionaries, where each dictionary must contain
                 'u_node', 'v_node', and the fields to update
                 (e.g., 'is_green_u', 'is_green_v', 'viz_color').
    """
    if supabase is None:
        print("Supabase client not initialized. Skipping database update.")
        return
    if not updates:
        # print("No edge state updates to push to Supabase.") # Can be noisy
        return

    print(f"Attempting to update {len(updates)} edge states in Supabase...")
    update_count = 0
    errors = []
    start_time = time.time()

    # Currently, supabase-py likely requires updating row by row based on non-PKs.
    # Consider RPC for bulk updates if performance becomes an issue.
    for edge_update in updates:
        try:
            # Extract keys and data for the update payload
            u_node = edge_update.get("u_node")
            v_node = edge_update.get("v_node")
            if u_node is None or v_node is None:
                print(
                    f"Warning: Skipping update due to missing u_node/v_node: {edge_update}"
                )
                continue

            # Data payload excludes the keys used for matching
            update_payload = {
                k: v for k, v in edge_update.items() if k not in ["u_node", "v_node"]
            }
            if not update_payload:
                print(
                    f"Warning: Skipping update due to empty payload for u={u_node}, v={v_node}"
                )
                continue

            # Perform the update matching on both u_node and v_node
            response = (
                supabase.table("road_segments")
                .update(update_payload)
                .eq("u_node", u_node)
                .eq("v_node", v_node)
                .execute()
            )

            # Check for errors in response
            if hasattr(response, "error") and response.error:
                errors.append(
                    f"Error updating u={u_node}, v={v_node}: {response.error}"
                )
            elif hasattr(response, "data") and response.data:
                update_count += len(
                    response.data
                )  # Count how many rows were matched/updated
            # else: # Handle cases where update might succeed but return no data (less common)
            #    update_count += 1 # Assume success if no error? Risky.

        except Exception as e:
            errors.append(f"Exception updating u={u_node}, v={v_node}: {e}")

    end_time = time.time()
    print(f"Supabase update process finished in {end_time - start_time:.2f}s.")
    print(f"Successfully updated {update_count} edge records.")
    if errors:
        print(f"Encountered {len(errors)} errors during update:")
        for error in errors[:5]:  # Print first few errors
            print(f"  - {error}")
