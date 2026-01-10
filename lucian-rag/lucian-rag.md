# MongoDB Atlas RAG for Your Agentic PR Solver

This guide provides a concise, straight-to-the-point approach for implementing the MongoDB Atlas indexing and Retrieval-Augmented Generation (RAG) component of your hackathon project. The focus is on a solution that is both impressive and achievable within the hackathon's time constraints.

## 1. Architecture Overview

The core idea is to transform your codebase into a searchable knowledge base that your agents can query to understand the code and solve PRs. The process is as follows:

1.  **Code Parsing & Chunking**: We'll parse the source code to identify logical blocks like functions and classes. This is more effective than arbitrarily splitting the code. Each block becomes a "chunk."
2.  **Embedding Generation**: Each chunk is converted into a numerical representation (a vector embedding) using an AI model (like Voyage AI, as suggested by the hackathon resources).
3.  **Indexing in MongoDB Atlas**: The code chunks and their corresponding embeddings are stored in a MongoDB Atlas collection.
4.  **Vector Search Index**: A special Vector Search index is created in Atlas to enable efficient searching based on semantic similarity.
5.  **RAG Querying**: When an agent needs to understand a part of the code, it will formulate a query (e.g., "How does the user authentication work?"). This query is converted into an embedding and used to search the Atlas collection for the most relevant code chunks.
6.  **Context for Agents**: The retrieved code chunks provide the necessary context for your coding agents to generate a solution.

This architecture is powerful because it allows agents to find conceptually related code, not just code that matches keywords.

## 2. Implementation Steps

Here are the key implementation steps with code samples.

### 2.1. Code Parsing and Chunking

First, you need to parse your code files into meaningful chunks. For Python code, we can use the built-in `ast` module to extract functions and classes. This is a robust approach that understands the code's structure.

Here is a Python script, `index_code.py`, that demonstrates this process. It traverses a directory, parses Python files, chunks them into functions and classes, generates embeddings (we'll simulate this for now), and stores them in MongoDB Atlas.


```python
# index_code.py
import os
import ast
from pymongo import MongoClient

# --- Configuration ---
MONGO_URI = "YOUR_MONGODB_ATLAS_URI"  # Replace with your MongoDB Atlas connection string
DB_NAME = "code_search_db"
COLLECTION_NAME = "code_embeddings"
CODE_ROOT_PATH = "/path/to/your/codebase"  # The path to the codebase you want to index

# --- Embedding Generation (Placeholder) ---
def get_embedding(text):
    """
    This is a placeholder function for embedding generation.
    In your actual implementation, you would call the Voyage AI API here.
    For the hackathon, you can use a simple placeholder like this to get started.
    """
    # Replace this with a call to your embedding model
    # For example, using the voyageai library:
    # import voyageai
    # vo = voyageai.Client()
    # result = vo.embed([text], model="voyage-2")
    # return result.embeddings[0]
    print(f"Generating embedding for: {text[:30]}...")
    # Return a dummy vector of the correct dimension for your model
    # Voyage models often have dimensions like 1024 or 1536. Check the model docs.
    return [0.1] * 1024 # Replace with your model's dimension

# --- Code Parsing and Chunking ---
def parse_and_chunk_code(file_path):
    """
    Parses a Python file and chunks it into functions and classes.
    """
    with open(file_path, "r") as source:
        try:
            tree = ast.parse(source.read(), filename=file_path)
        except SyntaxError as e:
            print(f"Could not parse {file_path}: {e}")
            return []

    chunks = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            chunk_text = ast.get_source_segment(tree, node)
            if chunk_text:
                chunks.append({
                    "file_path": file_path,
                    "type": node.__class__.__name__,
                    "name": node.name,
                    "code": chunk_text,
                })
    return chunks

# --- Main Indexing Logic ---
def main():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # Clear existing documents in the collection for a fresh index
    collection.delete_many({})
    print(f"Cleared collection: {COLLECTION_NAME}")

    documents_to_insert = []
    for root, _, files in os.walk(CODE_ROOT_PATH):
        for file in files:
            if file.endswith(".py"):
                file_path = os.path.join(root, file)
                print(f"Processing: {file_path}")
                chunks = parse_and_chunk_code(file_path)

                for chunk in chunks:
                    embedding = get_embedding(chunk["code"])
                    chunk["embedding"] = embedding
                    documents_to_insert.append(chunk)

    if documents_to_insert:
        collection.insert_many(documents_to_insert)
        print(f"Indexed {len(documents_to_insert)} code chunks.")
    else:
        print("No code chunks were indexed.")

    client.close()

if __name__ == "__main__":
    main()

```

### 2.2. Creating the Vector Search Index in MongoDB Atlas

Once your data is in MongoDB Atlas, you need to create a Vector Search index. This is done in the Atlas UI under the "Search" tab for your collection.

1.  Navigate to your collection in the Atlas UI.
2.  Click on the **Search** tab.
3.  Click **Create Search Index**.
4.  Select **JSON Editor** and click **Next**.
5.  Give your index a name (e.g., `vector_index`).
6.  Use the following JSON to define your index. This configuration tells Atlas to index the `embedding` field for vector search.

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "type": "vector",
        "dimensions": 1024,  // Make sure this matches your embedding model's dimension
        "similarity": "cosine"
      }
    }
  }
}
```

Click **Create Search Index**. It will take a few moments for the index to build.

### 2.3. Querying the Index (RAG)

Now for the fun part: querying the index to find relevant code. Here's a Python script, `query_code.py`, that demonstrates how to perform a vector search query.

```python
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

```

## 3. Final Recommendations for the Hackathon

*   **Focus on the `index_code.py` and `query_code.py` scripts.** These are the core of your RAG implementation.
*   **Use a small, representative codebase for testing.** This will speed up your development and testing cycles.
*   **Don't overengineer the chunking.** The function/class-based chunking provided is a great starting point. You can mention future improvements like handling comments or other languages in your presentation.
*   **For the x402 payment part**, you can simply have a placeholder function that checks for a valid payment before allowing the user to index or query the codebase. Your teammates can then integrate the actual Coinbase 402 logic there.

This approach provides a solid foundation for your agentic PR solver and is achievable within the hackathon's timeframe. Good luck!
