import re
from typing import Any, Dict, Iterator, List, Optional, Tuple

from pymongo import ASCENDING

from app.database import client, lds_collection, transcript_chunks_collection


SPEAKER_PREFIX = r"(?:O SR\.|A SRA\.|O SR|A SRA|SR\.|SRA\.)"
SPEAKER_MARKER = re.compile(
    rf"(?m)^(?P<label>{SPEAKER_PREFIX}(?:[^\n]*?\)|[^()\n]*?))\s*-\s*"
)
HONORIFIC = re.compile(r"^(O SR\.|A SRA\.|O SR|A SRA|SR\.|SRA\.)\s*")
AFFILIATION = re.compile(r"^(?P<affiliation>.+?)\s+-\s+(?P<state>[A-Z]{2})$")


def party_from_affiliation(affiliation: Optional[str]) -> Optional[str]:
    if not affiliation:
        return None
    return affiliation.rsplit("/", 1)[-1].strip()


def parse_speaker(label: str) -> Tuple[str, Dict[str, Optional[str]]]:
    """Extract speaker identity while retaining the source label."""
    honorific_match = HONORIFIC.match(label)
    honorific = honorific_match.group(1) if honorific_match else None
    body = HONORIFIC.sub("", label, count=1).strip()

    role = None
    affiliation = None
    state = None

    # Chair labels put the current chairperson and affiliation in parentheses.
    if body.startswith("PRESIDENTE(") and body.endswith(")"):
        role = "PRESIDENTE"
        details = body[len("PRESIDENTE(") : -1].strip()
        if ". " in details:
            name, affiliation_details = details.split(". ", 1)
            affiliation_match = AFFILIATION.match(affiliation_details)
            if affiliation_match:
                affiliation = affiliation_match.group("affiliation")
                state = affiliation_match.group("state")
            else:
                affiliation = affiliation_details
        else:
            name = details
    else:
        name = body
        if body.endswith(")") and "(" in body:
            possible_name, possible_affiliation = body.rsplit("(", 1)
            affiliation_match = AFFILIATION.match(possible_affiliation[:-1].strip())
            if affiliation_match:
                name = possible_name.strip()
                affiliation = affiliation_match.group("affiliation")
                state = affiliation_match.group("state")

    name = " ".join(name.split()) or "NÃO IDENTIFICADO"
    metadata = {
        "raw_label": label.strip(),
        "honorific": honorific,
        "role": role,
        "affiliation": affiliation,
        "party": party_from_affiliation(affiliation),
        "state": state,
    }
    return name, metadata


def make_chunk(
    record_id: int,
    index: int,
    name: str,
    metadata: Dict[str, Optional[str]],
    text: str,
    char_start: int,
    char_end: int,
) -> Dict[str, Any]:
    return {
        "record_id": record_id,
        "chunk_index": index,
        "speaker_name": name,
        "speaker_metadata": metadata,
        "text": text,
        "char_start": char_start,
        "char_end": char_end,
    }


def chunk_transcript(record_id: int, transcript: str) -> List[Dict[str, Any]]:
    matches = list(SPEAKER_MARKER.finditer(transcript))
    chunks: List[Dict[str, Any]] = []

    if matches and transcript[: matches[0].start()].strip():
        raw = transcript[: matches[0].start()]
        leading = len(raw) - len(raw.lstrip())
        text = raw.strip()
        chunks.append(
            make_chunk(
                record_id,
                0,
                "NÃO IDENTIFICADO",
                {
                    "raw_label": None,
                    "honorific": None,
                    "role": None,
                    "affiliation": None,
                    "party": None,
                    "state": None,
                },
                text,
                leading,
                leading + len(text),
            )
        )

    for match_number, match in enumerate(matches):
        raw_start = match.end()
        raw_end = matches[match_number + 1].start() if match_number + 1 < len(matches) else len(transcript)
        raw_text = transcript[raw_start:raw_end]
        text = raw_text.strip()
        if not text:
            continue
        leading = len(raw_text) - len(raw_text.lstrip())
        char_start = raw_start + leading
        name, metadata = parse_speaker(match.group("label"))
        chunks.append(
            make_chunk(
                record_id,
                len(chunks),
                name,
                metadata,
                text,
                char_start,
                char_start + len(text),
            )
        )

    if not matches and transcript.strip():
        text = transcript.strip()
        start = len(transcript) - len(transcript.lstrip())
        chunks.append(
            make_chunk(
                record_id,
                0,
                "NÃO IDENTIFICADO",
                {
                    "raw_label": None,
                    "honorific": None,
                    "role": None,
                    "affiliation": None,
                    "party": None,
                    "state": None,
                },
                text,
                start,
                start + len(text),
            )
        )
    return chunks


def main() -> None:
    client.admin.command("ping")
    transcript_chunks_collection.create_index(
        [("record_id", ASCENDING), ("chunk_index", ASCENDING)], unique=True
    )
    transcript_chunks_collection.create_index("speaker_name")

    total_records = 0
    total_chunks = 0
    source = lds_collection.find({}, {"_id": 0, "id": 1, "transcricao": 1}).sort("id", ASCENDING)
    for record in source:
        record_id = record["id"]
        chunks = chunk_transcript(record_id, record.get("transcricao", ""))
        # Re-running the importer safely replaces the chunks for this record.
        transcript_chunks_collection.delete_many({"record_id": record_id})
        if chunks:
            transcript_chunks_collection.insert_many(chunks, ordered=True)
        total_records += 1
        total_chunks += len(chunks)
        print(f"Record {record_id}: {len(chunks)} chunks")

    print(f"Saved {total_chunks} speaker chunks from {total_records} transcripts")
    client.close()


if __name__ == "__main__":
    main()
