import os
import math
import time
import pandas as pd
import geopandas as gpd
from supabase import create_client, Client
from dotenv import load_dotenv

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


# --- Database Helper Function ---
def insert_map_data_to_supabase(gdf: gpd.GeoDataFrame) -> str:
    """
    Prepares and inserts map data from GeoDataFrame into Supabase.

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

    # --- Handle list-type 'osmid' values ---
    # Check if 'osmid' column exists before attempting modification
    if "osmid" in df_for_db.columns:
        print("Processing 'osmid' column for potential lists...")

        # Apply a function to handle lists: take the first element if it's a non-empty list
        def clean_osmid(x):
            if isinstance(x, list):
                return (
                    x[0] if x else None
                )  # Take first element if list is not empty, else None
            return x  # Return original value if not a list

        df_for_db["osmid"] = df_for_db["osmid"].apply(clean_osmid)
        # Ensure the column is numeric or can be None, converting errors to None (NaT -> None)
        df_for_db["osmid"] = pd.to_numeric(df_for_db["osmid"], errors="coerce")
        print("'osmid' column processed.")
    # -----------------------------------------

    # Convert potentially problematic NaN/NaT values to None (SQL NULL)
    # This should happen *after* handling specific column issues like osmid lists
    print("Converting NaN/NaT values to None...")
    for col in df_for_db.columns:
        # Convert column to object type first to allow None storage
        # Apply where condition: keep original value if notna(), otherwise replace with None
        df_for_db[col] = (
            df_for_db[col].astype(object).where(df_for_db[col].notna(), None)
        )
    print("NaN/NaT conversion complete.")

    # Convert DataFrame to list of dictionaries
    print("Converting DataFrame to list of dictionaries...")
    data_to_insert = df_for_db.to_dict(orient="records")
    print("Conversion complete.")

    if not data_to_insert:
        status = "No data to insert"
        print(status)
        return status

    print(f"Prepared {len(data_to_insert)} records for insertion.")
    status = "Pending"  # Initial status before DB operations

    try:
        # 1. Clear existing data
        print("Clearing existing data in 'road_segments' table...")
        delete_response = (
            supabase.table("road_segments").delete().neq("id", -1).execute()
        )
        print(f"Delete response: {delete_response}")
        # Basic error check for delete
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

        for i in range(0, len(data_to_insert), batch_size):
            batch_start_time = time.time()
            batch = data_to_insert[i : i + batch_size]
            current_batch_num = i // batch_size + 1
            print(
                f"Inserting batch {current_batch_num}/{num_batches} ({len(batch)} records)..."
            )

            insert_response = supabase.table("road_segments").insert(batch).execute()

            # Check for errors in the insert response
            if hasattr(insert_response, "error") and insert_response.error:
                print(
                    f"  Error inserting batch {current_batch_num}. Response: {insert_response}"
                )
                error_details = getattr(
                    insert_response.error, "message", str(insert_response.error)
                )
                raise Exception(f"Error during batch insertion: {error_details}")
            elif (
                hasattr(insert_response, "data") and insert_response.data is not None
            ):  # Check data is not None
                inserted_count = len(insert_response.data)
                total_inserted += inserted_count
                batch_end_time = time.time()
                print(
                    f"  Batch {current_batch_num} successful ({inserted_count} records). Time: {batch_end_time - batch_start_time:.2f}s"
                )
            else:
                print(
                    f"  Warning: Unexpected response structure or empty data for batch {current_batch_num}. Response: {insert_response}"
                )

        status = f"Successfully inserted {total_inserted} records."
        print(f"Database population complete. Status: {status}")

    except Exception as e:
        status = f"Failed ({type(e).__name__}: {e})"
        print(f"Error during Supabase operation: {e}")

    return status
