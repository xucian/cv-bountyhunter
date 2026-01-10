# query_code.py
from pymongo import MongoClient

# --- Configuration ---
MONGO_URI = "YOUR_MONGODB_ATLAS_URI"  # Replace with your MongoDB Atlas connection string
DB_NAME = "code_search_db"
COLLECTION_NAME = "code_embeddings"

# --- Embedding Generation (Placeholder) ---
def get_embedding(text):
    """
    This is a placeholder function for embedding generation.
    In your actual implementation, you would call the Voyage AI API here.
    """
    # Replace this with a call to your embedding model
    print(f"Generating embedding for query: {text[:30]}...")
    return [0.1] * 1024 # Replace with your model's dimension

# --- Querying Logic ---
def search_code(query, limit=5):
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    query_embedding = get_embedding(query)

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",  # The name of your vector search index
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": 100, # Number of candidates to consider
                "limit": limit  # Number of results to return
            }
        },
        {
            "$project": {
                "_id": 0,
                "file_path": 1,
                "name": 1,
                "type": 1,
                "code": 1,
                "score": {
                    "$meta": "vectorSearchScore"
                }
            }
        }
    ]

    results = list(collection.aggregate(pipeline))

    client.close()
    return results

# --- Main Querying Logic ---
def main():
    user_query = "How is user authentication handled?"
    print(f"Searching for: '{user_query}'")

    search_results = search_code(user_query)

    print("\n--- Search Results ---")
    if search_results:
        for result in search_results:
            print(f"Score: {result['score']:.4f}")
            print(f"File: {result['file_path']}")
            print(f"Type: {result['type']}, Name: {result['name']}")
            print("--- Code ---")
            print(result['code'])
            print("--------------------\n")
    else:
        print("No results found.")

if __name__ == "__main__":
    main()
