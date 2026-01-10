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
