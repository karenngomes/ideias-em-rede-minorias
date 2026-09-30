import logging
import math
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Literal, Sequence

from openai import OpenAI
from pydantic import BaseModel, Field, field_validator, model_validator


logger = logging.getLogger(__name__)

DirectRelationType = Literal[
    "passar_palavra",
    "questionar",
    "responder",
    "complementar",
    "concordar",
    "discordar",
    "mudar_assunto",
    "sem_relacao",
]
IndirectRelationType = Literal[
    "retomada",
    "retomar",
    "referencia",
    "resposta_tardia",
    "complementar",
    "concordar",
    "discordar",
    "correcao",
    "citacao",
    "sem_relacao",
]
RelationType = Literal[
    "passar_palavra",
    "questionar",
    "responder",
    "complementar",
    "concordar",
    "discordar",
    "mudar_assunto",
    "retomada",
    "referencia",
    "resposta_tardia",
    "correcao",
    "citacao",
    "sem_relacao",
    "concordar_parcialmente",
    "discordar_parcialmente",
    "apoiar",
    "contestar",
    "elaborar",
    "justificar",
    "exemplificar",
    "fornecer_evidencia",
    "desafiar",
    "esclarecer",
    "reformular",
    "sintetizar",
    "propor",
    "aceitar_proposta",
    "rejeitar_proposta",
    "modificar_proposta",
    "comprometer_se",
    "solicitar",
    "organizar_debate",
]
RelationScope = Literal["direct", "indirect"]
InferenceApproach = Literal["rag_pairwise", "protocol", "protocol_rag"]


class ConversationChunk(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=50_000)
    position: float | None = None
    timestamp: datetime | None = None
    speaker_id: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def normalize_and_validate(self):
        self.id = self.id.strip()
        self.text = self.text.strip()
        if not self.id:
            raise ValueError("chunk id must not be blank")
        if not self.text:
            raise ValueError("chunk text must not be blank")
        if self.position is None and self.timestamp is None:
            raise ValueError("chunk must provide position or timestamp")
        if self.speaker_id is not None:
            self.speaker_id = self.speaker_id.strip() or None
        return self


class RelationInferenceRequest(BaseModel):
    chunks: list[ConversationChunk] = Field(min_length=1, max_length=500)
    approach: InferenceApproach = "rag_pairwise"
    candidate_count: int = Field(
        default_factory=lambda: int(os.getenv("RELATION_RAG_CANDIDATE_COUNT", "5")),
        ge=1,
        le=20,
    )
    min_confidence: float = Field(
        default_factory=lambda: float(os.getenv("RELATION_MIN_CONFIDENCE", "0.70")),
        ge=0.0,
        le=1.0,
    )

    @model_validator(mode="after")
    def validate_conversation(self):
        identifiers = [chunk.id for chunk in self.chunks]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("chunk identifiers must be unique")
        has_positions = all(chunk.position is not None for chunk in self.chunks)
        has_timestamps = all(chunk.timestamp is not None for chunk in self.chunks)
        if not has_positions and not has_timestamps:
            raise ValueError(
                "all chunks must use the same ordering field: position or timestamp"
            )
        values = (
            [chunk.position for chunk in self.chunks]
            if has_positions
            else [chunk.timestamp for chunk in self.chunks]
        )
        if len(values) != len(set(values)):
            raise ValueError("chunk positions or timestamps must be unique")
        return self


# O modelo às vezes usa sinônimos que o prompt menciona ("retomar", "corrigir");
# normaliza para os tipos canônicos antes de validar, em vez de descartar a audiência.
RELATION_TYPE_ALIASES = {"retomar": "retomada", "corrigir": "correcao"}


def normalize_relation_type(value):
    return RELATION_TYPE_ALIASES.get(value, value) if isinstance(value, str) else value


class RelationDecision(BaseModel):
    type: RelationType
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, value):
        return normalize_relation_type(value)


class DirectRelationDecision(RelationDecision):
    type: DirectRelationType


class IndirectRelationDecision(RelationDecision):
    type: IndirectRelationType


class ConversationRelation(BaseModel):
    source_chunk_id: str | None
    target_chunk_id: str
    scope: RelationScope
    type: RelationType
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, value):
        return normalize_relation_type(value)


class RelationInferenceResponse(BaseModel):
    approach: InferenceApproach
    relations: list[ConversationRelation]
    audit: list["RelationInferenceAudit"] = Field(default_factory=list)


class RetrievedChunkAudit(BaseModel):
    chunk_id: str
    text: str
    similarity: float


class PromptMessageAudit(BaseModel):
    role: Literal["system", "user"]
    content: str


class RelationInferenceAudit(BaseModel):
    target_chunk_id: str
    retrieved_chunks: list[RetrievedChunkAudit]
    prompt: list[PromptMessageAudit]
    raw_response: str
    parsed_response: dict


class ProtocolRelationDecision(BaseModel):
    source_chunk_id: str | None
    type: RelationType
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = Field(min_length=1, max_length=500)


class ProtocolChunkDecision(BaseModel):
    relations: list[ProtocolRelationDecision] = Field(min_length=1)


class EmbeddingServiceError(RuntimeError):
    pass


class InferenceServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class SemanticUnit:
    chunk_id: str
    chunk_order: int
    unit_order: int
    text: str


@dataclass(frozen=True)
class RetrievalCandidate:
    source_chunk_id: str
    target_chunk_id: str
    source_text: str
    target_text: str
    similarity: float


Embedder = Callable[[Sequence[str]], list[list[float]]]
Classifier = Callable[[ConversationChunk, ConversationChunk, RelationScope, str | None, str | None], RelationDecision]
ProtocolClassifier = Callable[[ConversationChunk, Sequence[ConversationChunk]], ProtocolChunkDecision]


@dataclass(frozen=True)
class ProtocolRagClassification:
    decision: ProtocolChunkDecision
    prompt: list[dict[str, str]]
    raw_response: str


ProtocolRagClassifier = Callable[
    [ConversationChunk, Sequence[ConversationChunk]], ProtocolRagClassification
]


DIRECT_SYSTEM_PROMPT = """
Você infere a relação discursiva principal entre duas falas consecutivas de uma
conversa. A fala de origem ocorre primeiro e a fala de destino ocorre depois.
Use exatamente um tipo: passar_palavra, questionar, responder, complementar,
concordar, discordar, mudar_assunto ou sem_relacao. Não confunda continuidade
temática com uma relação discursiva. Retorne uma justificativa curta em português
e confiança entre 0 e 1.
""".strip()


INDIRECT_SYSTEM_PROMPT = """
Você verifica se uma fala posterior se relaciona de fato com uma fala anterior
não consecutiva. A similaridade temática, por si só, não confirma relação. Exija
evidência de retomada, referência, resposta tardia, complemento, concordância,
discordância, correção ou citação. Caso contrário, use sem_relacao. Retorne uma
justificativa curta em português e confiança entre 0 e 1.
""".strip()


PROTOCOL_SYSTEM_PROMPT = """
Você anota relações entre falas de audiências públicas segundo este protocolo.
Analise a FALA_ATUAL contra todas as FALAS_ANTERIORES, sem usar distância como
critério. Uma fala pode ter zero, uma ou várias relações, inclusive mais de uma
relação com a mesma fala anterior. Use somente: concordar,
concordar_parcialmente, discordar, discordar_parcialmente, apoiar, contestar,
complementar, elaborar, justificar, exemplificar, fornecer_evidencia, corrigir,
questionar, desafiar, responder, esclarecer, reformular, retomar, sintetizar,
propor, aceitar_proposta, rejeitar_proposta, modificar_proposta, comprometer_se,
solicitar, passar_palavra, organizar_debate ou sem_relacao.

Ausência de discordância não significa concordância. Apoiar exige argumento
favorável; concordar exige aceitação. Contestar exige argumento contrário;
discordar exige rejeição. Similaridade temática isolada não é relação. Para cada
relação, a explicação deve responder quem faz o quê em relação a quem e sobre
qual questão. Se não houver relação identificável, retorne exatamente uma
relação sem_relacao, com source_chunk_id nulo. Nunca use sem_relacao junto com
outra classe e nunca relacione a fala atual a ela própria.
""".strip()


PROTOCOL_RAG_SYSTEM_PROMPT = PROTOCOL_SYSTEM_PROMPT.replace(
    "Analise a FALA_ATUAL contra todas as FALAS_ANTERIORES, sem usar distância como\ncritério.",
    "Analise a FALA_ATUAL contra as FALAS_RECUPERADAS pelo RAG. Os embeddings\nselecionam candidatos, mas similaridade temática isolada não confirma relação.",
)


def _openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key, max_retries=2, timeout=90.0)


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    try:
        response = _openai_client().embeddings.create(
            model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
            input=list(texts),
        )
        ordered = sorted(response.data, key=lambda item: item.index)
        embeddings = [item.embedding for item in ordered]
        if len(embeddings) != len(texts):
            raise RuntimeError("embedding response size does not match input size")
        return embeddings
    except Exception as error:
        logger.exception("Failed to generate conversation relation embeddings")
        raise EmbeddingServiceError("embedding service failed") from error


def classify_relation(
    source: ConversationChunk,
    target: ConversationChunk,
    scope: RelationScope,
    source_unit: str | None = None,
    target_unit: str | None = None,
) -> RelationDecision:
    system_prompt = DIRECT_SYSTEM_PROMPT if scope == "direct" else INDIRECT_SYSTEM_PROMPT
    source_text = source_unit or source.text
    target_text = target_unit or target.text
    user_prompt = (
        f"ESCOPO: {scope}\n"
        f"FALA_ORIGEM ({source.id}, falante={source.speaker_id or 'desconhecido'}):\n"
        f"{source_text}\n\n"
        f"FALA_DESTINO ({target.id}, falante={target.speaker_id or 'desconhecido'}):\n"
        f"{target_text}"
    )
    try:
        response = _openai_client().responses.parse(
            model=os.getenv(
                "OPENAI_RELATION_MODEL",
                os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-4o-mini"),
            ),
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            text_format=(DirectRelationDecision if scope == "direct" else IndirectRelationDecision),
        )
        result = response.output_parsed
        if result is None:
            raise RuntimeError("the model returned no parsed relation")
        return RelationDecision.model_validate(result.model_dump())
    except Exception as error:
        logger.exception(
            "Failed to classify %s relation from %s to %s",
            scope,
            source.id,
            target.id,
        )
        raise InferenceServiceError("relation inference service failed") from error


def classify_protocol_relations(
    target: ConversationChunk,
    previous: Sequence[ConversationChunk],
) -> ProtocolChunkDecision:
    previous_text = "\n\n".join(
        f"[{chunk.id}] falante={chunk.speaker_id or 'desconhecido'}\n{chunk.text}"
        for chunk in previous
    ) or "(nenhuma fala anterior)"
    user_prompt = (
        f"FALAS_ANTERIORES:\n{previous_text}\n\n"
        f"FALA_ATUAL [{target.id}] falante={target.speaker_id or 'desconhecido'}:\n"
        f"{target.text}"
    )
    try:
        response = _openai_client().responses.parse(
            model=os.getenv(
                "OPENAI_RELATION_MODEL",
                os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-4o-mini"),
            ),
            input=[
                {"role": "system", "content": PROTOCOL_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            text_format=ProtocolChunkDecision,
        )
        result = response.output_parsed
        if result is None:
            raise RuntimeError("the model returned no parsed protocol relations")
        return ProtocolChunkDecision.model_validate(result.model_dump())
    except Exception as error:
        logger.exception("Failed protocol relation classification for %s", target.id)
        raise InferenceServiceError("relation inference service failed") from error


def classify_protocol_rag_relations(
    target: ConversationChunk,
    candidates: Sequence[ConversationChunk],
) -> ProtocolRagClassification:
    candidates_text = "\n\n".join(
        f"[{chunk.id}] falante={chunk.speaker_id or 'desconhecido'}\n{chunk.text}"
        for chunk in candidates
    ) or "(nenhuma fala recuperada)"
    user_prompt = (
        f"FALAS_RECUPERADAS:\n{candidates_text}\n\n"
        f"FALA_ATUAL [{target.id}] falante={target.speaker_id or 'desconhecido'}:\n"
        f"{target.text}"
    )
    messages = [
        {"role": "system", "content": PROTOCOL_RAG_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    try:
        response = _openai_client().responses.parse(
            model=os.getenv(
                "OPENAI_RELATION_MODEL",
                os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-4o-mini"),
            ),
            input=messages,
            text_format=ProtocolChunkDecision,
        )
        result = response.output_parsed
        if result is None:
            raise RuntimeError("the model returned no parsed protocol RAG relations")
        decision = ProtocolChunkDecision.model_validate(result.model_dump())
        return ProtocolRagClassification(
            decision=decision,
            prompt=messages,
            raw_response=response.output_text or decision.model_dump_json(),
        )
    except Exception as error:
        logger.exception("Failed protocol RAG classification for %s", target.id)
        raise InferenceServiceError("relation inference service failed") from error


def order_chunks(chunks: Sequence[ConversationChunk]) -> list[ConversationChunk]:
    if all(chunk.position is not None for chunk in chunks):
        return sorted(chunks, key=lambda chunk: chunk.position)
    return sorted(chunks, key=lambda chunk: chunk.timestamp)


def split_semantic_units(chunks: Sequence[ConversationChunk]) -> list[SemanticUnit]:
    units = []
    for chunk_order, chunk in enumerate(chunks):
        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n\s*\n+", chunk.text)
            if paragraph.strip()
        ]
        if not paragraphs:
            paragraphs = [chunk.text]
        bounded_paragraphs = []
        for paragraph in paragraphs:
            cursor = 0
            while len(paragraph) - cursor > 4_000:
                boundary = paragraph.rfind(" ", cursor, cursor + 4_001)
                if boundary <= cursor:
                    boundary = cursor + 4_000
                bounded_paragraphs.append(paragraph[cursor:boundary].strip())
                cursor = boundary
                while cursor < len(paragraph) and paragraph[cursor].isspace():
                    cursor += 1
            if cursor < len(paragraph):
                bounded_paragraphs.append(paragraph[cursor:].strip())
        for unit_order, paragraph in enumerate(bounded_paragraphs):
            units.append(SemanticUnit(
                chunk_id=chunk.id,
                chunk_order=chunk_order,
                unit_order=unit_order,
                text=paragraph,
            ))
    return units


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or not left:
        raise EmbeddingServiceError("incompatible embedding dimensions")
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def retrieve_indirect_candidates(
    chunks: Sequence[ConversationChunk],
    candidate_count: int,
    embedder: Embedder = embed_texts,
) -> list[RetrievalCandidate]:
    units = split_semantic_units(chunks)
    if len(chunks) < 3:
        return []
    embeddings = embedder([unit.text for unit in units])
    if len(embeddings) != len(units):
        raise EmbeddingServiceError("embedding response size does not match semantic units")
    indexed = list(zip(units, embeddings))
    candidates = []
    for target_order in range(2, len(chunks)):
        target_units = [item for item in indexed if item[0].chunk_order == target_order]
        previous_units = [item for item in indexed if item[0].chunk_order <= target_order - 2]
        best_by_chunk: dict[str, RetrievalCandidate] = {}
        for target_unit, target_embedding in target_units:
            for source_unit, source_embedding in previous_units:
                similarity = cosine_similarity(source_embedding, target_embedding)
                candidate = RetrievalCandidate(
                    source_chunk_id=source_unit.chunk_id,
                    target_chunk_id=target_unit.chunk_id,
                    source_text=source_unit.text,
                    target_text=target_unit.text,
                    similarity=similarity,
                )
                current = best_by_chunk.get(source_unit.chunk_id)
                if current is None or candidate.similarity > current.similarity:
                    best_by_chunk[source_unit.chunk_id] = candidate
        ranked = sorted(
            best_by_chunk.values(),
            key=lambda item: (-item.similarity, item.source_chunk_id),
        )[:candidate_count]
        candidates.extend(ranked)
    return candidates


def retrieve_protocol_rag_candidates(
    chunks: Sequence[ConversationChunk],
    candidate_count: int,
    embedder: Embedder = embed_texts,
) -> dict[str, list[RetrievalCandidate]]:
    units = split_semantic_units(chunks)
    if len(chunks) < 2:
        return {}
    embeddings = embedder([unit.text for unit in units])
    if len(embeddings) != len(units):
        raise EmbeddingServiceError("embedding response size does not match semantic units")
    indexed = list(zip(units, embeddings))
    retrieved: dict[str, list[RetrievalCandidate]] = {}
    for target_order in range(1, len(chunks)):
        target_units = [item for item in indexed if item[0].chunk_order == target_order]
        previous_units = [item for item in indexed if item[0].chunk_order < target_order]
        best_by_chunk: dict[str, RetrievalCandidate] = {}
        for target_unit, target_embedding in target_units:
            for source_unit, source_embedding in previous_units:
                candidate = RetrievalCandidate(
                    source_chunk_id=source_unit.chunk_id,
                    target_chunk_id=target_unit.chunk_id,
                    source_text=source_unit.text,
                    target_text=target_unit.text,
                    similarity=cosine_similarity(source_embedding, target_embedding),
                )
                current = best_by_chunk.get(source_unit.chunk_id)
                if current is None or candidate.similarity > current.similarity:
                    best_by_chunk[source_unit.chunk_id] = candidate
        retrieved[chunks[target_order].id] = sorted(
            best_by_chunk.values(),
            key=lambda item: (-item.similarity, item.source_chunk_id),
        )[:candidate_count]
    return retrieved


def infer_rag_pairwise_relations(
    request: RelationInferenceRequest,
    embedder: Embedder = embed_texts,
    classifier: Classifier = classify_relation,
) -> RelationInferenceResponse:
    chunks = order_chunks(request.chunks)
    chunks_by_id = {chunk.id: chunk for chunk in chunks}
    relations: list[ConversationRelation] = []

    for source, target in zip(chunks, chunks[1:]):
        decision = classifier(source, target, "direct", None, None)
        if decision.confidence < request.min_confidence and decision.type != "sem_relacao":
            decision = RelationDecision(
                type="sem_relacao",
                confidence=1.0 - decision.confidence,
                reason="A relação sugerida ficou abaixo do limiar mínimo de confiança.",
            )
        relations.append(ConversationRelation(
            source_chunk_id=source.id,
            target_chunk_id=target.id,
            scope="direct",
            type=decision.type,
            confidence=decision.confidence,
            reason=decision.reason,
        ))

    candidates = retrieve_indirect_candidates(chunks, request.candidate_count, embedder)
    seen = set()
    for candidate in candidates:
        decision = classifier(
            chunks_by_id[candidate.source_chunk_id],
            chunks_by_id[candidate.target_chunk_id],
            "indirect",
            candidate.source_text,
            candidate.target_text,
        )
        if decision.type == "sem_relacao" or decision.confidence < request.min_confidence:
            continue
        key = (
            candidate.source_chunk_id,
            candidate.target_chunk_id,
            "indirect",
            decision.type,
        )
        if key in seen:
            continue
        seen.add(key)
        relations.append(ConversationRelation(
            source_chunk_id=candidate.source_chunk_id,
            target_chunk_id=candidate.target_chunk_id,
            scope="indirect",
            type=decision.type,
            confidence=decision.confidence,
            reason=decision.reason,
        ))

    logger.info(
        "Inferred conversation relations chunks=%d direct=%d indirect=%d",
        len(chunks),
        max(0, len(chunks) - 1),
        sum(relation.scope == "indirect" for relation in relations),
    )
    return RelationInferenceResponse(approach="rag_pairwise", relations=relations)


def infer_protocol_relations(
    request: RelationInferenceRequest,
    classifier: ProtocolClassifier = classify_protocol_relations,
) -> RelationInferenceResponse:
    chunks = order_chunks(request.chunks)
    relations: list[ConversationRelation] = []

    for target_order, target in enumerate(chunks):
        previous = chunks[:target_order]
        decision = classifier(target, previous)
        previous_ids = {chunk.id for chunk in previous}
        accepted: list[ProtocolRelationDecision] = []
        seen: set[tuple[str | None, str]] = set()

        for relation in decision.relations:
            if relation.type == "sem_relacao":
                continue
            if relation.source_chunk_id not in previous_ids:
                logger.warning(
                    "Discarding invalid protocol source=%s target=%s",
                    relation.source_chunk_id,
                    target.id,
                )
                continue
            if relation.confidence < request.min_confidence:
                continue
            key = (relation.source_chunk_id, relation.type)
            if key not in seen:
                seen.add(key)
                accepted.append(relation)

        if not accepted:
            no_relation = next(
                (item for item in decision.relations if item.type == "sem_relacao"),
                None,
            )
            relations.append(ConversationRelation(
                source_chunk_id=None,
                target_chunk_id=target.id,
                scope="indirect",
                type="sem_relacao",
                confidence=no_relation.confidence if no_relation else 1.0,
                reason=(
                    no_relation.reason
                    if no_relation
                    else "Não foi identificada relação com nenhuma fala anterior."
                ),
            ))
            continue

        for relation in accepted:
            source_order = next(
                index for index, chunk in enumerate(chunks)
                if chunk.id == relation.source_chunk_id
            )
            relations.append(ConversationRelation(
                source_chunk_id=relation.source_chunk_id,
                target_chunk_id=target.id,
                scope="direct" if source_order == target_order - 1 else "indirect",
                type=relation.type,
                confidence=relation.confidence,
                reason=relation.reason,
            ))

    logger.info(
        "Inferred protocol relations chunks=%d relations=%d",
        len(chunks),
        len(relations),
    )
    return RelationInferenceResponse(approach="protocol", relations=relations)


def infer_protocol_rag_relations(
    request: RelationInferenceRequest,
    embedder: Embedder = embed_texts,
    classifier: ProtocolRagClassifier = classify_protocol_rag_relations,
) -> RelationInferenceResponse:
    chunks = order_chunks(request.chunks)
    chunks_by_id = {chunk.id: chunk for chunk in chunks}
    order_by_id = {chunk.id: index for index, chunk in enumerate(chunks)}
    retrieved_by_target = retrieve_protocol_rag_candidates(
        chunks, request.candidate_count, embedder
    )
    relations = [ConversationRelation(
        source_chunk_id=None,
        target_chunk_id=chunks[0].id,
        scope="indirect",
        type="sem_relacao",
        confidence=1.0,
        reason="Primeira fala da conversa; não existem falas anteriores.",
    )]
    audit: list[RelationInferenceAudit] = []

    for target_order, target in enumerate(chunks[1:], start=1):
        candidates = retrieved_by_target.get(target.id, [])
        candidate_chunks = [ConversationChunk(
            id=candidate.source_chunk_id,
            text=candidate.source_text,
            position=chunks_by_id[candidate.source_chunk_id].position,
            timestamp=chunks_by_id[candidate.source_chunk_id].timestamp,
            speaker_id=chunks_by_id[candidate.source_chunk_id].speaker_id,
        ) for candidate in candidates]
        classification = classifier(target, candidate_chunks)
        decision = classification.decision
        candidate_ids = {candidate.source_chunk_id for candidate in candidates}
        accepted: list[ProtocolRelationDecision] = []
        seen: set[tuple[str | None, str]] = set()
        for relation in decision.relations:
            if relation.type == "sem_relacao":
                continue
            if relation.source_chunk_id not in candidate_ids:
                logger.warning(
                    "Discarding protocol RAG source=%s target=%s not retrieved",
                    relation.source_chunk_id,
                    target.id,
                )
                continue
            if relation.confidence < request.min_confidence:
                continue
            key = (relation.source_chunk_id, relation.type)
            if key not in seen:
                seen.add(key)
                accepted.append(relation)

        if not accepted:
            no_relation = next(
                (item for item in decision.relations if item.type == "sem_relacao"),
                None,
            )
            relations.append(ConversationRelation(
                source_chunk_id=None,
                target_chunk_id=target.id,
                scope="indirect",
                type="sem_relacao",
                confidence=no_relation.confidence if no_relation else 1.0,
                reason=no_relation.reason if no_relation else (
                    "Nenhuma relação foi confirmada entre os candidatos recuperados."
                ),
            ))
        else:
            for relation in accepted:
                source_order = order_by_id[relation.source_chunk_id]
                relations.append(ConversationRelation(
                    source_chunk_id=relation.source_chunk_id,
                    target_chunk_id=target.id,
                    scope="direct" if source_order == target_order - 1 else "indirect",
                    type=relation.type,
                    confidence=relation.confidence,
                    reason=relation.reason,
                ))

        audit.append(RelationInferenceAudit(
            target_chunk_id=target.id,
            retrieved_chunks=[RetrievedChunkAudit(
                chunk_id=candidate.source_chunk_id,
                text=candidate.source_text,
                similarity=candidate.similarity,
            ) for candidate in candidates],
            prompt=[PromptMessageAudit.model_validate(message)
                    for message in classification.prompt],
            raw_response=classification.raw_response,
            parsed_response=decision.model_dump(mode="json"),
        ))

    logger.info(
        "Inferred protocol RAG relations chunks=%d relations=%d audit_calls=%d",
        len(chunks), len(relations), len(audit),
    )
    return RelationInferenceResponse(
        approach="protocol_rag", relations=relations, audit=audit
    )


def infer_conversation_relations(
    request: RelationInferenceRequest,
    embedder: Embedder = embed_texts,
    classifier: Classifier = classify_relation,
    protocol_classifier: ProtocolClassifier = classify_protocol_relations,
    protocol_rag_classifier: ProtocolRagClassifier = classify_protocol_rag_relations,
) -> RelationInferenceResponse:
    if request.approach == "protocol":
        return infer_protocol_relations(request, protocol_classifier)
    if request.approach == "protocol_rag":
        return infer_protocol_rag_relations(
            request, embedder, protocol_rag_classifier
        )
    return infer_rag_pairwise_relations(request, embedder, classifier)
