import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Callable, Literal

from openai import OpenAI
from pydantic import BaseModel
from pymongo import ASCENDING

from app.database import (
    classification_jobs_collection,
    persuasion_results_collection,
    transcript_chunks_collection,
)


ApproachName = Literal["persuationclassifcona_7_class_few_shot"]

FEW_SHOT_SEVEN_CLASSES_PROMPT_VERSION = "persuationclassifcona-7-class-few-shot-paragraphs-v2-pt-2026-09-20"
MODEL = lambda: os.getenv("OPENAI_CLASSIFICATION_MODEL", "gpt-4o-mini")


def prompt_version(approach: str) -> str:
    return FEW_SHOT_SEVEN_CLASSES_PROMPT_VERSION


FewShotCategory = Literal[
    "Attack on reputation",
    "Justification",
    "Simplification",
    "Distraction",
    "Call",
    "Manipulative wording",
    "Nenhuma",
]


class FewShotAnnotation(BaseModel):
    categoria: FewShotCategory
    trecho: str
    explicacao: str


class FewShotSevenClassesClassification(BaseModel):
    anotacoes: list[FewShotAnnotation]


class PreNormalizedClassification(BaseModel):
    normalized: dict


FEW_SHOT_SEVEN_CLASSES_PROMPT = """
Você é um anotador especializado em técnicas de persuasão no discurso de
audiências públicas do Congresso Nacional do Brasil.

Sua tarefa é analisar exclusivamente o TEXTO_ALVO, utilizando o
CONTEXTO_ANTERIOR e o CONTEXTO_POSTERIOR apenas para compreender referências,
interlocutores, assunto e intenção discursiva.

## Categorias permitidas

Use somente as categorias abaixo. A classificação pode ser multilabel.

### 1. Attack on reputation

O argumento não enfrenta diretamente o assunto discutido, mas ataca ou
desqualifica uma pessoa, grupo, organização, instituição, objeto ou atividade
para reduzir sua credibilidade. Inclui insultos e rótulos dirigidos a um alvo;
questionamento de competência, experiência ou credibilidade; acusações de
hipocrisia ou incoerência; associação do alvo a pessoas, grupos ou práticas
vistas negativamente; e alegações negativas sobre caráter, moralidade ou
reputação. Não classifique críticas fundamentadas diretamente na proposta, nos
dados ou no mérito do argumento como ataque à reputação.

### 2. Justification

Há uma posição, conclusão, recomendação ou decisão acompanhada de uma razão
usada para justificá-la ou apoiá-la. A justificativa pode recorrer a autoridade
ou experiência; valores morais, religiosos ou democráticos; patriotismo ou
interesse de um grupo; popularidade ou opinião da maioria; medo de uma
consequência; tradição ou prática estabelecida. A simples presença dessas
palavras não basta. Deve ser possível identificar o que está sendo defendido,
rejeitado ou justificado e a razão ou apelo empregado para sustentá-lo. A
posição pode estar implícita ou aparecer no contexto, desde que a relação de
justificativa seja clara.

### 3. Simplification

O argumento reduz excessivamente um problema complexo, especialmente ao
apresentar uma única causa como explicação suficiente; tratar duas alternativas
como as únicas possíveis; afirmar que existe apenas uma solução; apresentar uma
cadeia inevitável ou altamente especulativa de consequências; ou ignorar etapas,
condições ou alternativas relevantes. Não use esta categoria apenas porque
faltam detalhes ou porque a explicação parece superficial.

### 4. Distraction

O texto desvia a atenção do tema ou argumento principal em vez de respondê-lo
diretamente. Inclui substituir a posição original por uma versão distorcida,
introduzir informação irrelevante, responder a uma crítica levantando outro
caso ou mudar de assunto para evitar a questão. Informação adicional,
comparação ou contextualização relevante não constitui distração.

### 5. Call

O texto procura incentivar o público ou os participantes a agir, deixar de
agir, apoiar, rejeitar ou adotar determinada forma de pensar. Inclui pedidos e
convocações diretas, palavras de ordem e slogans, apelos para agir imediatamente
e frases destinadas a encerrar o debate ou impedir questionamentos. Pedidos
administrativos ou procedimentais normalmente não constituem Call.

### 6. Manipulative wording

O texto emprega palavras ou expressões não neutras, emocionalmente carregadas,
confusas, vagas, exageradas ou minimizadoras para influenciar a percepção do
público. Inclui linguagem fortemente positiva ou negativa, exagero ou
minimização, formulação deliberadamente vaga ou confusa e repetição persuasiva.
Uma opinião não é automaticamente linguagem manipulativa. Quando uma expressão
carregada desacreditar diretamente um alvo, considere também Attack on
reputation se ambas as definições forem claramente satisfeitas.

### 7. Nenhuma

Use quando o TEXTO_ALVO não contiver evidência suficiente das seis categorias
anteriores, como descrição factual neutra, pergunta genuína, explicação técnica,
crítica pertinente ao mérito, fala procedimental ou afirmação dependente de
suposições externas. Nenhuma é exclusiva e nunca pode aparecer com outra
categoria.

## Regras de anotação

1. Adote uma abordagem conservadora. Em caso de dúvida, não atribua a categoria.
2. Não procure obrigatoriamente uma técnica de persuasão.
3. Não faça fact-checking nem use conhecimento externo.
4. Evite julgamentos políticos, partidários, morais ou pessoais.
5. Considere interlocutores e tema, mas classifique somente o TEXTO_ALVO.
6. Extraia o menor trecho literal, exato e contínuo do TEXTO_ALVO que comprove cada categoria.
7. Se partes diferentes sustentarem a mesma categoria, produza objetos separados.
8. Se o mesmo trecho sustentar mais de uma categoria, produza um objeto para cada uma.
9. Se Nenhuma for escolhida, use o TEXTO_ALVO completo como evidência.
10. A explicação deve ligar concretamente o trecho à definição, sem especular.
""".strip()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key, max_retries=2, timeout=90.0)


def classify_few_shot_seven_classes(
    text: str,
    previous_context: str = "",
    next_context: str = "",
    include_audit: bool = False,
) -> FewShotSevenClassesClassification | tuple[FewShotSevenClassesClassification, dict]:
    user_input = "\n\n".join([
        f"CONTEXTO_ANTERIOR:\n{previous_context or '[não há]'}",
        f"TEXTO_ALVO:\n{text}",
        f"CONTEXTO_POSTERIOR:\n{next_context or '[não há]'}",
    ])
    response = _client().responses.parse(
        model=MODEL(),
        input=[
            {"role": "system", "content": FEW_SHOT_SEVEN_CLASSES_PROMPT},
            {"role": "user", "content": user_input},
        ],
        text_format=FewShotSevenClassesClassification,
    )
    result = response.output_parsed
    if result is None:
        raise RuntimeError("The model returned no parsed classification")
    audit = {
        "model": MODEL(),
        "prompt": {
            "system": FEW_SHOT_SEVEN_CLASSES_PROMPT,
            "user": user_input,
        },
        "response": result.model_dump(mode="json"),
        "captured_at": utc_now(),
    }
    if not result.anotacoes:
        raise ValueError("The model returned no annotations")
    none_annotations = [item for item in result.anotacoes if item.categoria == "Nenhuma"]
    positive_annotations = [
        item for item in result.anotacoes if item.categoria != "Nenhuma"
    ]
    invalid_positive_count = sum(
        item.categoria != "Nenhuma" and _locate_excerpt(text, item.trecho) is None
        for item in result.anotacoes
    )
    warnings = []
    if none_annotations and positive_annotations:
        warnings.append("A categoria Nenhuma foi removida porque havia categorias positivas válidas.")
    if invalid_positive_count:
        warnings.append(
            f"{invalid_positive_count} anotação(ões) foram mantidas, mas suas evidências "
            "não foram encontradas integralmente no texto-alvo."
        )
    if warnings:
        audit["validation_warnings"] = warnings
    if positive_annotations:
        # Enforce the prompt's exclusivity rule. Non-verbatim evidence remains
        # available for audit and is marked as unreliable during normalization.
        classification = FewShotSevenClassesClassification(anotacoes=positive_annotations)
        return (classification, audit) if include_audit else classification
    if none_annotations:
        none_annotation = none_annotations[0].model_copy(update={"trecho": text})
        classification = FewShotSevenClassesClassification(anotacoes=[none_annotation])
        return (classification, audit) if include_audit else classification
    raise ValueError("The model returned neither a positive category nor Nenhuma")


def _split_long_range(text: str, start: int, end: int, max_chars: int) -> list[tuple[int, int, str]]:
    segments = []
    cursor = start
    while end - cursor > max_chars:
        limit = cursor + max_chars
        candidates = [
            text.rfind(". ", cursor, limit),
            text.rfind("! ", cursor, limit),
            text.rfind("? ", cursor, limit),
            text.rfind("\n", cursor, limit),
            text.rfind(" ", cursor, limit),
        ]
        boundary = max(candidates) + 1
        if boundary <= cursor:
            boundary = limit
        segment_start = cursor
        while segment_start < boundary and text[segment_start].isspace():
            segment_start += 1
        segment_end = boundary
        while segment_end > segment_start and text[segment_end - 1].isspace():
            segment_end -= 1
        if segment_start < segment_end:
            segments.append((segment_start, segment_end, text[segment_start:segment_end]))
        cursor = boundary
    while cursor < end and text[cursor].isspace():
        cursor += 1
    while end > cursor and text[end - 1].isspace():
        end -= 1
    if cursor < end:
        segments.append((cursor, end, text[cursor:end]))
    return segments


def split_paragraphs_merging_short(
    text: str, min_chars: int = 250, max_chars: int = 4_000
) -> list[tuple[int, int, str]]:
    """Split on line breaks, merge short runs forward, and cap oversized ranges."""
    paragraphs = [
        (match.start(), match.end(), match.group())
        for match in re.finditer(r"[^\r\n]*\S[^\r\n]*", text)
    ]
    if not paragraphs:
        return []

    merged: list[list[int]] = []
    pending: list[int] | None = None
    for start, end, paragraph in paragraphs:
        if pending is not None:
            pending[1] = end
            if pending[1] - pending[0] >= min_chars:
                merged.append(pending)
                pending = None
        elif len(paragraph) < min_chars:
            pending = [start, end]
        else:
            merged.append([start, end])

    if pending is not None:
        if merged:
            merged[-1][1] = pending[1]
        else:
            merged.append(pending)

    segments = []
    for start, end in merged:
        if end - start > max_chars:
            segments.extend(_split_long_range(text, start, end, max_chars))
        else:
            segments.append((start, end, text[start:end]))
    return segments


def classify_few_shot_seven_classes_by_paragraph(
    text: str,
    include_audit: bool = False,
) -> PreNormalizedClassification | tuple[PreNormalizedClassification, dict]:
    paragraphs = split_paragraphs_merging_short(text, min_chars=250, max_chars=4_000)
    if not paragraphs:
        raise ValueError("The speech contains no non-empty paragraph")

    category_names = {
        "Attack on reputation": "ataque_a_reputacao",
        "Justification": "justificativa",
        "Simplification": "simplificacao",
        "Distraction": "distracao",
        "Call": "chamada",
        "Manipulative wording": "linguagem_manipulativa",
    }
    classifications = []
    superclass_classifications = []
    no_classification_explanations = []
    executions = []
    delay = max(0.0, float(os.getenv("OPENAI_CLASSIFICATION_DELAY_SECONDS", "5")))

    for index, (paragraph_start, paragraph_end, paragraph) in enumerate(paragraphs):
        previous_context = paragraphs[index - 1][2] if index > 0 else ""
        next_context = paragraphs[index + 1][2] if index + 1 < len(paragraphs) else ""
        result, execution = classify_few_shot_seven_classes(
            paragraph,
            previous_context=previous_context,
            next_context=next_context,
            include_audit=True,
        )
        execution.update({
            "paragraph_index": index,
            "start": paragraph_start,
            "end": paragraph_end,
            "target_text": paragraph,
        })
        executions.append(execution)

        if result.anotacoes[0].categoria == "Nenhuma":
            no_classification_explanations.append(result.anotacoes[0].explicacao)
        else:
            for annotation in result.anotacoes:
                offsets = _locate_excerpt(paragraph, annotation.trecho)
                reliable = offsets is not None
                if offsets is None:
                    start = end = None
                    evidence_text = annotation.trecho
                    warning = (
                        "O trecho retornado pelo modelo não foi encontrado integralmente "
                        "no parágrafo-alvo. A anotação foi mantida para auditoria."
                    )
                else:
                    local_start, local_end = offsets
                    start = paragraph_start + local_start
                    end = paragraph_start + local_end
                    evidence_text = text[start:end]
                    warning = None
                superclass = category_names[annotation.categoria]
                evidence = {
                    "text": evidence_text,
                    "start": start,
                    "end": end,
                    "verbatim": reliable,
                    "reliable": reliable,
                    "warning": warning,
                }
                classifications.append({
                    "superclass": superclass,
                    "explanation": annotation.explicacao,
                    "evidence": [evidence],
                    "evidence_reliable": reliable,
                    "evidence_warnings": [warning] if warning else [],
                    "subclasses": [],
                    "paragraph_index": index,
                })
                superclass_classifications.append({
                    "superclass": superclass,
                    "text_spans": [evidence["text"]],
                    "span_offsets": [{"start": start, "end": end}],
                    "explanation": annotation.explicacao,
                    "evidence_reliable": reliable,
                    "evidence_warnings": [warning] if warning else [],
                    "paragraph_index": index,
                })
        if index < len(paragraphs) - 1:
            time.sleep(delay)

    normalized = PreNormalizedClassification(normalized={
        "classifications": classifications,
        "superclass_classifications": superclass_classifications,
        "subclass_classifications": [],
        "annotations": [],
        "no_classification_explanation": (
            " ".join(dict.fromkeys(no_classification_explanations))
            if not classifications and no_classification_explanations
            else None
        ),
        "segmentation": {
            "strategy": "line_breaks_merge_short_forward",
            "min_chars": 250,
            "max_chars": 4_000,
            "segment_count": len(paragraphs),
            "segments": [
                {"index": index, "start": start, "end": end}
                for index, (start, end, _) in enumerate(paragraphs)
            ],
        },
    })
    audit = {
        "model": MODEL(),
        "strategy": "one_call_per_merged_paragraph",
        "min_chars": 250,
        "max_chars": 4_000,
        "executions": executions,
        "captured_at": utc_now(),
    }
    return (normalized, audit) if include_audit else normalized


APPROACHES: dict[str, Callable[[str], BaseModel]] = {
    "persuationclassifcona_7_class_few_shot": classify_few_shot_seven_classes_by_paragraph,
}

APPROACH_CAPABILITIES: dict[str, dict[str, bool]] = {
    "persuationclassifcona_7_class_few_shot": {"has_subclasses": False},
}


def available_approaches() -> list[str]:
    return sorted(APPROACHES)


def approach_capabilities(approach: str) -> dict[str, bool]:
    return APPROACH_CAPABILITIES.get(approach, {"has_subclasses": False})


def _locate_excerpt(text: str, excerpt: str):
    start = text.find(excerpt)
    if start >= 0:
        return start, start + len(excerpt)
    parts = excerpt.split()
    if not parts:
        return None
    match = re.search(r"\s+".join(re.escape(part) for part in parts), text, re.IGNORECASE)
    return (match.start(), match.end()) if match else None


def _normalize_spans(text: str, excerpts: list[str]) -> list[dict]:
    spans = []
    for excerpt in excerpts:
        offsets = _locate_excerpt(text, excerpt)
        if offsets is None:
            raise ValueError("Model evidence is not a verbatim excerpt of the speech")
        start, end = offsets
        spans.append({"text": text[start:end], "start": start, "end": end})
    return spans


def normalize_result(result: BaseModel, text: str) -> dict:
    if isinstance(result, PreNormalizedClassification):
        return result.normalized
    if isinstance(result, FewShotSevenClassesClassification):
        category_names = {
            "Attack on reputation": "ataque_a_reputacao",
            "Justification": "justificativa",
            "Simplification": "simplificacao",
            "Distraction": "distracao",
            "Call": "chamada",
            "Manipulative wording": "linguagem_manipulativa",
        }
        if result.anotacoes[0].categoria == "Nenhuma":
            return {
                "classifications": [],
                "superclass_classifications": [],
                "subclass_classifications": [],
                "annotations": [],
                "no_classification_explanation": result.anotacoes[0].explicacao,
            }
        classifications = []
        superclass_classifications = []
        for item in result.anotacoes:
            span = _normalize_spans(text, [item.trecho])[0]
            superclass = category_names[item.categoria]
            classifications.append({
                "superclass": superclass,
                "explanation": item.explicacao,
                "evidence": [span],
                "subclasses": [],
            })
            superclass_classifications.append({
                "superclass": superclass,
                "text_spans": [span["text"]],
                "span_offsets": [{"start": span["start"], "end": span["end"]}],
                "explanation": item.explicacao,
            })
        return {
            "classifications": classifications,
            "superclass_classifications": superclass_classifications,
            "subclass_classifications": [],
            "annotations": [],
            "no_classification_explanation": None,
        }
    raise TypeError(f"Unsupported classification result: {type(result).__name__}")


def create_approach_job(record_id: int, approach: str, experiments_tag: str) -> str:
    job_id = str(uuid.uuid4())
    total = transcript_chunks_collection.count_documents({"record_id": record_id})
    classification_jobs_collection.insert_one({
        "job_id": job_id, "record_id": record_id, "approach": approach,
        "experiments_tag": experiments_tag, "status": "queued", "model": MODEL(),
        "prompt_version": prompt_version(approach), "total": total, "processed": 0, "failed": 0,
        "created_at": utc_now(), "started_at": None, "finished_at": None, "last_error": None,
    })
    return job_id


def run_approach_job(job_id: str, record_id: int, approach: str, experiments_tag: str) -> None:
    classifier = APPROACHES[approach]
    delay = max(0.0, float(os.getenv("OPENAI_CLASSIFICATION_DELAY_SECONDS", "5")))
    classification_jobs_collection.update_one(
        {"job_id": job_id}, {"$set": {"status": "running", "started_at": utc_now()}}
    )
    chunks = list(transcript_chunks_collection.find(
        {"record_id": record_id}, {"text": 1, "chunk_index": 1, "speaker_name": 1}
    ).sort("chunk_index", ASCENDING))
    processed = failed = 0
    try:
        for position, chunk in enumerate(chunks):
            try:
                raw_result, audit = classifier(chunk["text"], include_audit=True)
                classification = normalize_result(raw_result, chunk["text"])
                persuasion_results_collection.replace_one(
                    {"job_id": job_id, "chunk_index": chunk["chunk_index"]},
                    {"job_id": job_id, "record_id": record_id, "approach": approach,
                     "experiments_tag": experiments_tag, "chunk_index": chunk["chunk_index"],
                     "speaker_name": chunk.get("speaker_name"), "text": chunk["text"],
                     "classification": classification, "model": MODEL(),
                     "audit": audit,
                     "prompt_version": prompt_version(approach), "classified_at": utc_now()},
                    upsert=True,
                )
            except Exception as error:
                failed += 1
                error_message = str(error) or error.__class__.__name__
                persuasion_results_collection.replace_one(
                    {"job_id": job_id, "chunk_index": chunk["chunk_index"]},
                    {"job_id": job_id, "record_id": record_id, "approach": approach,
                     "experiments_tag": experiments_tag, "chunk_index": chunk["chunk_index"],
                     "speaker_name": chunk.get("speaker_name"), "text": chunk["text"],
                     "classification": None,
                     "classification_error": {
                         "type": error.__class__.__name__,
                         "message": error_message[:4_000],
                         "occurred_at": utc_now(),
                     },
                     "model": MODEL(), "prompt_version": prompt_version(approach),
                     "classified_at": utc_now()},
                    upsert=True,
                )
                classification_jobs_collection.update_one(
                    {"job_id": job_id}, {"$set": {"last_error": error_message[:1000]}}
                )
            finally:
                processed += 1
                classification_jobs_collection.update_one(
                    {"job_id": job_id}, {"$set": {"processed": processed, "failed": failed}}
                )
            if position < len(chunks) - 1:
                time.sleep(delay)
        final_status = "completed" if failed == 0 else "completed_with_errors"
        classification_jobs_collection.update_one(
            {"job_id": job_id}, {"$set": {"status": final_status, "finished_at": utc_now()}}
        )
    except Exception as error:
        classification_jobs_collection.update_one(
            {"job_id": job_id}, {"$set": {"status": "failed", "last_error": str(error)[:1000],
                                             "finished_at": utc_now()}}
        )
