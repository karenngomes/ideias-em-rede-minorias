import json
from pathlib import Path
from typing import Iterator, Tuple

from pymongo import ReplaceOne

from app.database import client, lds_collection, nli_collection


DATASETS: Tuple[Tuple[Path, object], ...] = (
    (Path("dados/PublicHearingBR_LDS.jsonl"), lds_collection),
    (Path("dados/PublicHearingBR_NLI.jsonl"), nli_collection),
)


def read_jsonl(path: Path) -> Iterator[dict]:
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid JSON in {path}, line {line_number}") from error


def import_file(path: Path, collection) -> int:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    operations = []
    for document in read_jsonl(path):
        record_id = document.get("id")
        if record_id is None:
            raise ValueError(f"Record without an id in {path}")
        operations.append(ReplaceOne({"id": record_id}, document, upsert=True))

    if operations:
        collection.bulk_write(operations, ordered=False)
    collection.create_index("id", unique=True)
    return len(operations)


def main() -> None:
    client.admin.command("ping")
    for path, collection in DATASETS:
        count = import_file(path, collection)
        print(f"Imported {count} records into {collection.full_name}")
    client.close()


if __name__ == "__main__":
    main()
