from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
import uuid
from threading import Thread
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from pymongo import ASCENDING
from pymongo.errors import PyMongoError

from app.database import (
    client,
    classification_jobs_collection,
    conversation_relation_runs_collection,
    lds_collection,
    nli_collection,
    persuasion_results_collection,
    transcript_chunks_collection,
)
from app.conversation_relations import (
    EmbeddingServiceError,
    InferenceApproach,
    InferenceServiceError,
    RelationInferenceRequest,
    RelationInferenceResponse,
    infer_conversation_relations,
)
from app.persuasion_approaches import (
    approach_capabilities,
    available_approaches,
    create_approach_job,
    run_approach_job,
)


class PersuasionClassificationRequest(BaseModel):
    id: int = Field(gt=0, description="ID da sessão/audiência (registro LDS)")
    approach: str = Field(min_length=1, max_length=100)
    experiments_tag: str = Field(min_length=1, max_length=100)

    @field_validator("approach", "experiments_tag")
    @classmethod
    def strip_non_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


def without_mongo_id(document: Dict[str, Any]) -> Dict[str, Any]:
    document.pop("_id", None)
    return document


def find_by_id(collection, record_id: int, projection=None) -> Dict[str, Any]:
    document = collection.find_one({"id": record_id}, projection)
    if document is None:
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
    return without_mongo_id(document)


def paginated(collection, page: int, page_size: int, projection=None) -> Dict[str, Any]:
    skip = (page - 1) * page_size
    cursor = (
        collection.find({}, projection)
        .sort("id", ASCENDING)
        .skip(skip)
        .limit(page_size)
    )
    items = [without_mongo_id(document) for document in cursor]
    total = collection.count_documents({})
    return {"page": page, "page_size": page_size, "total": total, "items": items}


@asynccontextmanager
async def lifespan(_: FastAPI):
    client.admin.command("ping")
    lds_collection.create_index("id", unique=True)
    nli_collection.create_index("id", unique=True)
    transcript_chunks_collection.create_index(
        [("record_id", ASCENDING), ("chunk_index", ASCENDING)], unique=True
    )
    transcript_chunks_collection.create_index("speaker_name")
    classification_jobs_collection.create_index("job_id", unique=True)
    classification_jobs_collection.create_index(
        [("record_id", ASCENDING), ("created_at", -1)]
    )
    persuasion_results_collection.create_index(
        [("job_id", ASCENDING), ("chunk_index", ASCENDING)], unique=True
    )
    conversation_relation_runs_collection.create_index("run_id", unique=True)
    conversation_relation_runs_collection.create_index(
        [("record_id", ASCENDING), ("created_at", -1)]
    )
    persuasion_results_collection.create_index(
        [("record_id", ASCENDING), ("approach", ASCENDING),
         ("experiments_tag", ASCENDING), ("chunk_index", ASCENDING)]
    )
    yield
    client.close()


app = FastAPI(
    title="PublicHearingBR API",
    version="1.0.0",
    description="API for the LDS transcripts and NLI evaluation data.",
    lifespan=lifespan,
)


@app.get("/")
def root() -> Dict[str, str]:
    return {"message": "PublicHearingBR API", "docs": "/docs"}


@app.get("/health")
def health() -> Dict[str, Any]:
    try:
        client.admin.command("ping")
        return {
            "status": "ok",
            "mongodb": "connected",
            "lds_records": lds_collection.count_documents({}),
            "nli_records": nli_collection.count_documents({}),
            "transcript_chunks": transcript_chunks_collection.count_documents({}),
        }
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="MongoDB unavailable") from error


@app.post(
    "/conversation-relations/infer",
    response_model=RelationInferenceResponse,
    summary="Infer direct and indirect relations between conversation chunks",
)
def infer_relations(request: RelationInferenceRequest) -> RelationInferenceResponse:
    """Evaluate consecutive chunks and validate RAG candidates from earlier chunks."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")
    try:
        return infer_conversation_relations(request)
    except EmbeddingServiceError as error:
        raise HTTPException(status_code=502, detail="Embedding service unavailable") from error
    except InferenceServiceError as error:
        raise HTTPException(status_code=502, detail="Relation inference service unavailable") from error


def audience_relation_chunks(record_id: int) -> list[dict]:
    return [
        {
            "id": f"chunk-{chunk['chunk_index'] + 1}",
            "chunk_index": chunk["chunk_index"],
            "speaker_id": chunk.get("speaker_name"),
            "text": chunk["text"],
        }
        for chunk in transcript_chunks_collection.find(
            {"record_id": record_id},
            {"_id": 0, "chunk_index": 1, "speaker_name": 1, "text": 1},
        ).sort("chunk_index", ASCENDING)
    ]


def available_relation_runs(record_id: int) -> list[dict]:
    """Execução mais recente de cada abordagem já gerada para a audiência."""
    latest: Dict[str, dict] = {}
    for run in conversation_relation_runs_collection.find(
        {"record_id": record_id},
        {"_id": 0, "approach": 1, "run_id": 1, "created_at": 1},
    ).sort("created_at", -1):
        latest.setdefault(run.get("approach") or "rag_pairwise", run)
    return [
        {"approach": approach, "run_id": run["run_id"], "created_at": run["created_at"]}
        for approach, run in latest.items()
    ]


def audience_relation_payload(
    record_id: int, run: dict | None, approach: str | None = None
) -> Dict[str, Any]:
    chunks = audience_relation_chunks(record_id)
    available = available_relation_runs(record_id)
    if run is None:
        return {
            "record_id": record_id,
            "status": "not_started",
            "run_id": None,
            "created_at": None,
            "candidate_count": None,
            "min_confidence": None,
            "approach": approach,
            "model": None,
            "embedding_model": None,
            "relations": [],
            "audit": [],
            "chunks": chunks,
            "available": available,
        }
    without_mongo_id(run)
    return {**run, "chunks": chunks, "available": available}


@app.get("/lds/{record_id}/conversation-relations")
def get_audience_relations(
    record_id: int,
    approach: InferenceApproach | None = Query(
        default=None, description="Abordagem; sem ela, devolve a execução mais recente"
    ),
) -> Dict[str, Any]:
    if not lds_collection.find_one({"id": record_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
    query: Dict[str, Any] = {"record_id": record_id}
    if approach:
        query["approach"] = approach
    run = conversation_relation_runs_collection.find_one(query, sort=[("created_at", -1)])
    return audience_relation_payload(record_id, run, approach)


@app.post("/lds/{record_id}/conversation-relations")
def generate_audience_relations(
    record_id: int,
    approach: InferenceApproach = Query(default="rag_pairwise"),
    candidate_count: int = Query(
        default=int(os.getenv("RELATION_RAG_CANDIDATE_COUNT", "5")), ge=1, le=20
    ),
    min_confidence: float = Query(
        default=float(os.getenv("RELATION_MIN_CONFIDENCE", "0.70")), ge=0.0, le=1.0
    ),
) -> Dict[str, Any]:
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")
    if not lds_collection.find_one({"id": record_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
    chunks = audience_relation_chunks(record_id)
    if not chunks:
        raise HTTPException(status_code=422, detail="Record has no transcript chunks")
    request = RelationInferenceRequest(
        chunks=[
            {
                "id": chunk["id"],
                "text": chunk["text"],
                "position": chunk["chunk_index"],
                "speaker_id": chunk["speaker_id"],
            }
            for chunk in chunks
        ],
        candidate_count=candidate_count,
        min_confidence=min_confidence,
        approach=approach,
    )
    try:
        result = infer_conversation_relations(request)
    except EmbeddingServiceError as error:
        raise HTTPException(status_code=502, detail="Embedding service unavailable") from error
    except InferenceServiceError as error:
        raise HTTPException(status_code=502, detail="Relation inference service unavailable") from error
    run = {
        "run_id": str(uuid.uuid4()),
        "record_id": record_id,
        "status": "completed",
        "candidate_count": candidate_count,
        "min_confidence": min_confidence,
        "approach": approach,
        "model": os.getenv(
            "OPENAI_RELATION_MODEL",
            os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-4o-mini"),
        ),
        "embedding_model": os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        "relations": [relation.model_dump(mode="json") for relation in result.relations],
        "audit": [entry.model_dump(mode="json") for entry in result.audit],
        "created_at": datetime.now(timezone.utc),
    }
    conversation_relation_runs_collection.insert_one(run)
    return audience_relation_payload(record_id, run)


@app.get("/lds")
def list_lds(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
) -> Dict[str, Any]:
    # Transcripts are intentionally omitted from list responses.
    result = paginated(lds_collection, page, page_size, {"_id": 0, "transcricao": 0})
    record_ids = [item["id"] for item in result["items"]]
    chunk_counts = {
        row["_id"]: row["count"]
        for row in transcript_chunks_collection.aggregate(
            [
                {"$match": {"record_id": {"$in": record_ids}}},
                {"$group": {"_id": "$record_id", "count": {"$sum": 1}}},
            ]
        )
    }
    classified_counts = {
        row["_id"]: row["count"]
        for row in persuasion_results_collection.aggregate(
            [
                {
                    "$match": {
                        "record_id": {"$in": record_ids},
                        "classification": {"$ne": None},
                    }
                },
                {"$group": {"_id": {"record_id": "$record_id", "chunk": "$chunk_index"}}},
                {"$group": {"_id": "$_id.record_id", "count": {"$sum": 1}}},
            ]
        )
    }
    active_record_ids = set(
        classification_jobs_collection.distinct(
            "record_id",
            {
                "record_id": {"$in": record_ids},
                "status": {"$in": ["queued", "running"]},
            },
        )
    )
    for item in result["items"]:
        record_id = item["id"]
        chunk_count = chunk_counts.get(record_id, 0)
        classified_count = classified_counts.get(record_id, 0)
        item["chunk_count"] = chunk_count
        item["classified_chunk_count"] = classified_count
        if record_id in active_record_ids:
            item["classification_status"] = "running"
        elif chunk_count > 0 and classified_count == chunk_count:
            item["classification_status"] = "completed"
        elif classified_count > 0:
            item["classification_status"] = "partial"
        else:
            item["classification_status"] = "not_started"
    return result


@app.get("/lds/{record_id}")
def get_lds(
    record_id: int,
    include_transcript: bool = Query(False),
) -> Dict[str, Any]:
    projection = {"_id": 0} if include_transcript else {"_id": 0, "transcricao": 0}
    return find_by_id(lds_collection, record_id, projection)


@app.get("/lds/{record_id}/transcript")
def get_transcript(record_id: int) -> Dict[str, Any]:
    return find_by_id(
        lds_collection,
        record_id,
        {"_id": 0, "id": 1, "transcricao": 1},
    )


@app.get("/lds/{record_id}/chunks")
def get_transcript_chunks(
    record_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    classification_job_id: str | None = Query(None),
) -> Dict[str, Any]:
    if not lds_collection.find_one({"id": record_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")

    query = {"record_id": record_id}
    skip = (page - 1) * page_size
    cursor = (
        transcript_chunks_collection.find(query, {"_id": 0})
        .sort("chunk_index", ASCENDING)
        .skip(skip)
        .limit(page_size)
    )
    items = list(cursor)
    if classification_job_id:
        job = classification_jobs_collection.find_one(
            {"job_id": classification_job_id, "record_id": record_id, "approach": {"$exists": True}},
            {"_id": 1},
        )
        if not job:
            raise HTTPException(status_code=404, detail="Classification not found for this record")
        chunk_indexes = [item["chunk_index"] for item in items]
        results = {
            result["chunk_index"]: result
            for result in persuasion_results_collection.find(
                {"job_id": classification_job_id, "chunk_index": {"$in": chunk_indexes}},
                {
                    "_id": 0,
                    "chunk_index": 1,
                    "classification": 1,
                    "classification_error": 1,
                    "audit": 1,
                },
            )
        }
        for item in items:
            result = results.get(item["chunk_index"])
            item["selected_classification"] = result.get("classification") if result else None
            item["selected_classification_error"] = (
                result.get("classification_error") if result else None
            )
            item["selected_classification_audit"] = result.get("audit") if result else None

    return {
        "record_id": record_id,
        "page": page,
        "page_size": page_size,
        "total": transcript_chunks_collection.count_documents(query),
        "items": items,
    }


@app.get("/lds/{record_id}/persuasion-classifications")
def list_record_persuasion_classifications(record_id: int) -> Dict[str, Any]:
    if not lds_collection.find_one({"id": record_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail=f"Record {record_id} not found")
    jobs = list(classification_jobs_collection.find(
        {"record_id": record_id, "approach": {"$in": available_approaches()}}, {"_id": 0}
    ).sort("created_at", -1))
    counts = {
        row["_id"]: row["count"]
        for row in persuasion_results_collection.aggregate([
            {"$match": {"job_id": {"$in": [job["job_id"] for job in jobs]}}},
            {"$group": {"_id": "$job_id", "count": {"$sum": 1}}},
        ])
    } if jobs else {}
    for job in jobs:
        job["result_count"] = counts.get(job["job_id"], 0)
        job.update(approach_capabilities(job["approach"]))
    return {"record_id": record_id, "items": jobs}


@app.post("/persuasion-classifications", status_code=status.HTTP_202_ACCEPTED)
def create_persuasion_classification(request: PersuasionClassificationRequest) -> Dict[str, Any]:
    """Classify every speech in an audience using a versioned approach."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")
    if request.approach not in available_approaches():
        raise HTTPException(status_code=422, detail={
            "message": f"Unknown approach: {request.approach}",
            "available_approaches": available_approaches(),
        })
    if not lds_collection.find_one({"id": request.id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail=f"Record {request.id} not found")
    active = classification_jobs_collection.find_one({
        "record_id": request.id, "approach": request.approach,
        "experiments_tag": request.experiments_tag,
        "status": {"$in": ["queued", "running"]},
    }, {"_id": 0})
    if active:
        raise HTTPException(status_code=409, detail={
            "message": "Classification already running for this experiment", "job_id": active["job_id"]
        })

    job_id = create_approach_job(request.id, request.approach, request.experiments_tag)
    job = classification_jobs_collection.find_one({"job_id": job_id}, {"_id": 0})
    if job["total"] == 0:
        classification_jobs_collection.update_one(
            {"job_id": job_id}, {"$set": {"status": "completed", "finished_at": datetime.now(timezone.utc)}}
        )
    else:
        Thread(target=run_approach_job,
               args=(job_id, request.id, request.approach, request.experiments_tag), daemon=True).start()
    return {
        "job_id": job_id, "id": request.id, "approach": request.approach,
        "experiments_tag": request.experiments_tag, "status": "queued" if job["total"] else "completed",
        "total": job["total"], "status_url": f"/persuasion-classifications/{job_id}",
        "results_url": f"/persuasion-classifications/{job_id}/results",
    }


@app.get("/persuasion-classification-approaches")
def list_persuasion_classification_approaches() -> Dict[str, Any]:
    names = available_approaches()
    return {
        "items": names,
        "approaches": [
            {"name": name, **approach_capabilities(name)} for name in names
        ],
    }


@app.get("/persuasion-classified-records")
def list_persuasion_classified_records() -> Dict[str, Any]:
    """Audiences that have at least one run of an available approach."""
    jobs = list(classification_jobs_collection.find(
        {"approach": {"$in": available_approaches()}},
        {"_id": 0, "job_id": 1, "record_id": 1, "experiments_tag": 1, "created_at": 1},
    ).sort("created_at", -1))
    counts = {
        row["_id"]: row["count"]
        for row in persuasion_results_collection.aggregate([
            {"$match": {"job_id": {"$in": [job["job_id"] for job in jobs]}}},
            {"$group": {"_id": "$job_id", "count": {"$sum": 1}}},
        ])
    } if jobs else {}
    subjects = {
        row["id"]: row.get("metadados", {}).get("assunto")
        for row in lds_collection.find(
            {"id": {"$in": list({job["record_id"] for job in jobs})}},
            {"_id": 0, "id": 1, "metadados.assunto": 1},
        )
    }
    records: Dict[int, Dict[str, Any]] = {}
    for job in jobs:
        if not counts.get(job["job_id"]):
            continue
        record = records.setdefault(job["record_id"], {
            "id": job["record_id"], "assunto": subjects.get(job["record_id"]), "runs": [],
        })
        record["runs"].append({
            "job_id": job["job_id"], "experiments_tag": job["experiments_tag"],
            "result_count": counts[job["job_id"]],
        })
    return {"items": sorted(records.values(), key=lambda record: record["id"])}


@app.get("/persuasion-classifications/{job_id}/summary")
def get_persuasion_classification_summary(job_id: str) -> Dict[str, Any]:
    """Chunks per class, overall and split between parliamentarians and guests.

    A speaker counts as a parliamentarian when any of their chunks in the audience
    carries a party, because the affiliation only appears on the first speech.
    """
    job = classification_jobs_collection.find_one(
        {"job_id": job_id, "approach": {"$in": available_approaches()}}, {"_id": 0}
    )
    if not job:
        raise HTTPException(status_code=404, detail=f"Classification job {job_id} not found")
    parliamentarians = set(transcript_chunks_collection.distinct(
        "speaker_name", {"record_id": job["record_id"], "speaker_metadata.party": {"$nin": [None, ""]}}
    ))
    groups = {
        group: {"chunks": 0, "classified": 0, "failed": 0, "none": 0, "classes": {}}
        for group in ("total", "parlamentar", "convidado")
    }
    for result in persuasion_results_collection.find(
        {"job_id": job_id}, {"_id": 0, "speaker_name": 1, "classification": 1}
    ):
        group = "parlamentar" if result.get("speaker_name") in parliamentarians else "convidado"
        classification = result.get("classification")
        labels = {
            item["superclass"]
            for item in (classification or {}).get("superclass_classifications") or []
        }
        for key in ("total", group):
            summary = groups[key]
            summary["chunks"] += 1
            if classification is None:
                summary["failed"] += 1
                continue
            summary["classified"] += 1
            if not labels:
                summary["none"] += 1
            for label in labels:
                summary["classes"][label] = summary["classes"].get(label, 0) + 1
    return {
        "job_id": job_id, "record_id": job["record_id"],
        "experiments_tag": job["experiments_tag"], "total_chunks": job["total"],
        "parlamentares": sorted(parliamentarians), "groups": groups,
    }


@app.get("/persuasion-classifications/{job_id}")
def get_persuasion_classification_job(job_id: str) -> Dict[str, Any]:
    job = classification_jobs_collection.find_one({"job_id": job_id, "approach": {"$exists": True}}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail=f"Classification job {job_id} not found")
    job["result_count"] = persuasion_results_collection.count_documents({"job_id": job_id})
    return job


@app.get("/persuasion-classifications/{job_id}/results")
def get_persuasion_classification_results(
    job_id: str, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500)
) -> Dict[str, Any]:
    job = classification_jobs_collection.find_one({"job_id": job_id, "approach": {"$exists": True}}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail=f"Classification job {job_id} not found")
    query = {"job_id": job_id}
    items = list(persuasion_results_collection.find(query, {"_id": 0})
                 .sort("chunk_index", ASCENDING).skip((page - 1) * page_size).limit(page_size))
    return {"job_id": job_id, "id": job["record_id"], "approach": job["approach"],
            "experiments_tag": job["experiments_tag"], "status": job["status"],
            "page": page, "page_size": page_size,
            "total": persuasion_results_collection.count_documents(query), "items": items}


@app.get("/chunks")
def search_transcript_chunks(
    speaker_name: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    query = {"speaker_name": {"$regex": speaker_name, "$options": "i"}}
    skip = (page - 1) * page_size
    cursor = (
        transcript_chunks_collection.find(query, {"_id": 0})
        .sort([("record_id", ASCENDING), ("chunk_index", ASCENDING)])
        .skip(skip)
        .limit(page_size)
    )
    return {
        "speaker_name": speaker_name,
        "page": page,
        "page_size": page_size,
        "total": transcript_chunks_collection.count_documents(query),
        "items": list(cursor),
    }


@app.get("/nli")
def list_nli(
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=20),
) -> Dict[str, Any]:
    return paginated(nli_collection, page, page_size, {"_id": 0})


@app.get("/nli/{record_id}")
def get_nli(record_id: int) -> Dict[str, Any]:
    return find_by_id(nli_collection, record_id, {"_id": 0})


@app.get("/records/{record_id}")
def get_combined_record(record_id: int) -> Dict[str, Any]:
    lds = find_by_id(lds_collection, record_id, {"_id": 0, "transcricao": 0})
    nli = find_by_id(nli_collection, record_id, {"_id": 0})
    return {"id": record_id, "lds": lds, "nli": nli}
