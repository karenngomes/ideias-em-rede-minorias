import os

from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv()

MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb://admin:change-this-password@localhost:27017/?authSource=admin",
)
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "public_hearing_br")

client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5_000)
database = client[MONGODB_DATABASE]
lds_collection = database["lds"]
nli_collection = database["nli"]
transcript_chunks_collection = database["transcript_chunks"]
classification_jobs_collection = database["classification_jobs"]
persuasion_results_collection = database["persuasion_classification_results"]
