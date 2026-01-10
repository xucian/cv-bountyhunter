# Retrieval-Augmented Generation (RAG) with MongoDB - Atlas - MongoDB Docs

**URL:** https://www.mongodb.com/docs/atlas/atlas-vector-search/rag/

---

___
MongoDB.local SF, Jan 15: See the speaker lineup & ship your AI vision faster. Use WEB50 to save 50%
Find out more >
Products
Resources
Solutions
Company
Pricing
Get Started
Docs Home
GET STARTED
DEVELOPMENT
DATABASE MANUAL
8.2 (Current)
Overview
Documents
Databases & Collections
Client Libraries
Connect to Clusters
Database Users
CRUD Operations
Indexes
Data Modeling
Aggregation Operations
Search
Vector Search
Quick Start
Compatibility & Limitations
Create Embeddings
Queries & Indexes
Use Cases & Design Patterns
Retrieval-Augmented Generation (RAG)
Playground Chatbot Demo Builder
AI Agents
Local RAG
Semantic Search for Text
Hybrid Search
Review Deployment Options
Vector Quantization
Improve Accuracy
Performance Benchmark
Multi-Tenant Architecture
AI Integrations
Troubleshooting
Changelog
AI Integrations
Time Series
Change Streams
Transactions
Data Federation
In-Use Encryption
Development Checklist
Replication
Sharding
Performance
Reference
Support
STREAMING DATA
Atlas Stream Processing
Atlas Triggers
RELEASE NOTES
Server Release Notes
Atlas Release Notes
Search Release Notes
Vector Search Release Notes
MANAGEMENT
CLIENT LIBRARIES
TOOLS
ATLAS ARCHITECTURE CENTER
Ask MongoDB AI
Docs Home
/
Development
/
Vector Search
/
Use Cases & Design Patterns
Retrieval-Augmented Generation (RAG) with MongoDB
Copy page

Retrieval-augmented generation (RAG) is an architecture used to augment large language models (LLMs) with additional data so that they can generate more accurate responses. You can implement RAG in your generative AI applications by combining an LLM with a retrieval system powered by MongoDB Vector Search.

Get Started

To quickly try RAG with MongoDB Vector Search, use the Chatbot Demo Builder in the MongoDB Search Playground. To learn more, see Chatbot Demo Builder in Search Playground.

To implement your own RAG system with MongoDB Vector Search, see the tutorial on this page.

Why use RAG?

When working with LLMs, you might encounter the following limitations:

Stale data: LLMs are trained on a static dataset up to a certain point in time. This means that they have a limited knowledge base and might use outdated data.

No access to additional data: LLMs don't have access to local, personalized, or domain-specific data. Therefore, they can lack knowledge about specific domains.

Hallucinations: When grounded in incomplete or outdated data, LLMs can generate inaccurate responses.

You can address these limitations by taking the following steps to implement RAG:

Ingestion: Store your custom data as vector embeddings in a vector database, such as MongoDB. This allows you to create a knowledge base of up-to-date and personalized data.

Retrieval: Retrieve semantically similar documents from the database based on the user's question by using a search solution, such as MongoDB Vector Search. These documents augment the LLM with additional, relevant data.

Generation: Prompt the LLM. The LLM uses the retrieved documents as context to generate a more accurate and relevant response, reducing hallucinations.

RAG is an effective architecture for building AI chatbots, as it enables AI systems to provide personalized, domain-specific responses. To create production-ready chatbots, configure a server to route requests and build a user interface on top of your RAG implementation.

RAG with MongoDB Vector Search

To implement RAG with MongoDB Vector Search, you ingest data into MongoDB, retrieve documents with MongoDB Vector Search, and generate responses using an LLM. This section describes the components of a basic, or naive, RAG implementation with MongoDB Vector Search. For step-by-step instructions, see Tutorial.

Learn by Watching

Watch a video that demonstrates how to implement RAG with MongoDB Vector Search.

Duration: 5 Minutes

Ingestion

Data ingestion for RAG involves processing your custom data and storing it in a vector database to prepare it for retrieval. To create a basic ingestion pipeline with MongoDB as the vector database, do the following:

Prepare your data.

Load, process, and chunk, your data to prepare it for your RAG application. Chunking involves splitting your data into smaller parts for optimal retrieval.

Convert the data to vector embeddings.

Convert your data into vector embeddings by using an embedding model. To learn more, see How to Create Vector Embeddings.

Store the data and embeddings in MongoDB.

Store these embeddings in your cluster. You store embeddings as a field alongside other data in your collection.

Retrieval

Building a retrieval system involves searching for and returning the most relevant documents from your vector database to augment the LLM with. To retrieve relevant documents with MongoDB Vector Search, you convert the user's question into vector embeddings and run a vector search query against the data in your MongoDB collection to find documents with the most similar embeddings.

To perform basic retrieval with MongoDB Vector Search, do the following:

Define an MongoDB Vector Search index on the collection that contains your vector embeddings.

Choose one of the following methods to retrieve documents based on the user's question:

Use an MongoDB Vector Search integration with a popular framework or service. These integrations include built-in libraries and tools that enable you to easily build retrieval systems with MongoDB Vector Search.

Build your own retrieval system. You can define your own functions and pipelines to run MongoDB Vector Search queries specific to your use case.

To learn how to build a basic retrieval system with MongoDB Vector Search, see Tutorial.

Generation

To generate responses, combine your retrieval system with an LLM. After you perform a vector search to retrieve relevant documents, you provide the user's question along with the relevant documents as context to the LLM so that it can generate a more accurate response.

Choose one of the following methods to connect to an LLM:

Use an MongoDB Vector Search integration with a popular framework or service. These integrations include built-in libraries and tools to help you connect to LLMs with minimal set-up.

Call the LLM's API. Most AI providers offer APIs to their generative models that you can use to generate responses.

Load an open-source LLM. If you don't have API keys or credits, you can use an open-source LLM by loading it locally from your application. For an example implementation, see the Build a Local RAG Implementation with MongoDB Vector Search tutorial.

Tutorial

The following example demonstrates how to implement RAG with a retrieval system powered by MongoDB Vector Search. Select your preferred embedding model, LLM, and programming language to get started:

LANGUAGE
Python
EMBEDDING MODEL
Voyage AI
LLM
OpenAI

Work with a runnable version of this tutorial as a Python notebook.

Prerequisites

To complete this example, you must have the following:

One of the following MongoDB cluster types:

An Atlas cluster running MongoDB version 6.0.11, 7.0.2, or later. Ensure that your IP address is included in your Atlas project's access list.

A local Atlas deployment created using the Atlas CLI. To learn more, see Create a Local Atlas Deployment.

A MongoDB Community or Enterprise cluster with Search and Vector Search installed.

A Voyage AI API Key. To create an account and API Key, see the Voyage AI website.

An OpenAI API Key. You must have an OpenAI account with credits available for API requests. To learn more about registering an OpenAI account, see the OpenAI API website.

An environment to run interactive Python notebooks such as Colab.

Procedure
1
Set up the environment.

Create an interactive Python notebook by saving a file with the .ipynb extension. This notebook allows you to run Python code snippets individually. In your notebook, run the following code to install the dependencies for this tutorial:

pip install --quiet --upgrade pymongo voyageai openai langchain langchain_community pypdf

Then, run the following code to set the environment variables for this tutorial, replacing the placeholders with your API keys.

import os

os.environ["VOYAGE_API_KEY"] = "<voyage-api-key>"
os.environ["OPENAI_API_KEY"] = "<openai-api-key>"
2
Ingest data into your MongoDB deployment.

In this section, you ingest sample data into MongoDB that LLMs don't have access to. Paste and run each of the following code snippets in your notebook:

Define a function to generate vector embeddings.

Paste and run the following code in your notebook to create a function named get_embedding() that generates vector embeddings by using an embedding model from Voyage AI. Replace <api-key> with your Voyage API key.

The function specifies the following:

voyage-3-large as the embedding model to use.

input_type parameter to optimize your embeddings for retrieval. To learn more, see Voyage AI Python API.

TIP

For all models and parameters, see Voyage AI Text Embeddings.

import os
import voyageai

# Specify the embedding model
model = "voyage-3-large"
vo = voyageai.Client()

# Define a function to generate embeddings
def get_embedding(data, input_type = "document"):
  embeddings = vo.embed(
      data, model = model, input_type = input_type
  ).embeddings
  return embeddings[0]

Load and split the data.

Run this code to load and split sample data by using the LangChain integration. Specifically, this code does the following:

Loads a PDF that contains a MongoDB earnings report.

Splits the data into chunks, specifying the chunk size (number of characters) and chunk overlap (number of overlapping characters between consecutive chunks).

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Load the PDF
loader = PyPDFLoader("https://investors.mongodb.com/node/12236/pdf")
data = loader.load()

# Split the data into chunks
text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=20)
documents = text_splitter.split_documents(data)

Convert the data to vector embeddings.

Run this code to prepare the chunked documents for ingestion by creating a list of documents with their corresponding vector embeddings. You generate these embeddings by using the get_embedding() function that you just defined.

# Prepare documents for insertion
docs_to_insert = [{
    "text": doc.page_content,
    "embedding": get_embedding(doc.page_content)
} for doc in documents]

Store the data and embeddings in MongoDB.

Run this code to insert the documents containing the embeddings into the rag_db.test collection. Before running the code, replace <connection-string> with your MongoDB connection string.

from pymongo import MongoClient

# Connect to your MongoDB deployment
client = MongoClient("<connection-string>")
collection = client["rag_db"]["test"]

# Insert documents into the collection
result = collection.insert_many(docs_to_insert)
TIP

After you run the code, if you're using Atlas, you can verify your vector embeddings by navigating to the rag_db.test namespace in the Atlas UI.

3
Use MongoDB Vector Search to retrieve documents.

In this section, you create a retrieval system using MongoDB Vector Search to get relevant documents from your vector database. Paste and run each of the following code snippets in your notebook:

Create a MongoDB Vector Search index on your vector embeddings.

Run the following code to create the index directly from your application with the PyMongo Driver. This code also includes a polling mechanism to check if the index is ready to use.

To learn more, see How to Index Fields for Vector Search.

from pymongo.operations import SearchIndexModel
import time

# Create your index model, then create the search index
index_name="vector_index"
search_index_model = SearchIndexModel(
  definition = {
    "fields": [
      {
        "type": "vector",
        "numDimensions": 1024,
        "path": "embedding",
        "similarity": "cosine"
      }
    ]
  },
  name = index_name,
  type = "vectorSearch"
)
collection.create_search_index(model=search_index_model)

# Wait for initial sync to complete
print("Polling to check if the index is ready. This may take up to a minute.")
predicate=None
if predicate is None:
   predicate = lambda index: index.get("queryable") is True

while True:
   indices = list(collection.list_search_indexes(index_name))
   if len(indices) and predicate(indices[0]):
      break
   time.sleep(5)
print(index_name + " is ready for querying.")

Define a function to run vector search queries.

Run this code to create a retrieval function called get_query_results() that runs a basic vector search query. It uses the get_embedding() function to create embeddings from the search query. Then, it runs the query to return semantically similar documents.

To learn more, see Run Vector Search Queries.

# Define a function to run vector search queries
def get_query_results(query):
  """Gets results from a vector search query."""

  query_embedding = get_embedding(query, input_type="query")
  pipeline = [
      {
            "$vectorSearch": {
              "index": "vector_index",
              "queryVector": query_embedding,
              "path": "embedding",
              "exact": True,
              "limit": 5
            }
      }, {
            "$project": {
              "_id": 0,
              "text": 1
         }
      }
  ]

  results = collection.aggregate(pipeline)

  array_of_results = []
  for doc in results:
      array_of_results.append(doc)
  return array_of_results

# Test the function with a sample query
import pprint
pprint.pprint(get_query_results("AI technology"))
VIEW OUTPUT
4
Generate responses with the LLM.

In this section, you generate responses by prompting an LLM to use the retrieved documents as context. This code does the following:

Uses the get_query_results() function you defined to retrieve relevant documents from your collection.

Creates a prompt using the user's question and retrieved documents as context.

Prompts the LLM about MongoDB's latest AI announcements. The generated response might vary.

from openai import OpenAI

# Specify search query, retrieve relevant documents, and convert to string
query = "What are MongoDB's latest AI announcements?"
context_docs = get_query_results(query)
context_string = " ".join([doc["text"] for doc in context_docs])

# Construct prompt for the LLM using the retrieved documents as the context
prompt = f"""Use the following pieces of context to answer the question at the end.
    {context_string}
    Question: {query}
"""

openai_client = OpenAI()

# OpenAI model to use
model_name = "gpt-4o"

completion = openai_client.chat.completions.create(
model=model_name,
messages=[{"role": "user",
    "content": prompt
  }]
)
print(completion.choices[0].message.content)
HIDE OUTPUT
MongoDB recently announced several developments in its AI ecosystem. 
These include the MongoDB AI Applications Program (MAAP), which offers 
reference architectures, pre-built partner integrations, and professional
services to help customers efficiently build AI-powered applications. 
Accenture is the first global systems integrator to join MAAP and will 
establish a center of excellence for MongoDB projects. Additionally, 
MongoDB introduced significant updates, including faster performance 
in version 8.0 and the general availability of Atlas Stream Processing 
to enable real-time, event-driven applications. These advancements 
highlight MongoDB's focus on supporting AI-powered applications and 
modernizing legacy workloads.
Next Steps

For additional RAG tutorials, see the following resources:

To learn how to implement RAG with popular LLM frameworks and AI services, see MongoDB AI Integrations.

To learn how to implement RAG using a local Atlas deployment and local models, see Build a Local RAG Implementation with MongoDB Vector Search.

For use-case based tutorials and interactive Python notebooks, see Docs Notebooks Repository and Generative AI Use Cases Repository.

To build AI agents and implement agentic RAG, see Build AI Agents with MongoDB.

(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)