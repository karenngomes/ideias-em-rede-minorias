"""Leitura do corpus PublicHearingBR e da divisão entre audiências de minorias e demais."""

import json
from functools import lru_cache
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DIR_CORPUS = RAIZ / "dados" / "PublicHearingBR"
ARQUIVO_LDS = DIR_CORPUS / "PublicHearingBR_LDS.jsonl"
ARQUIVO_ROTULOS = RAIZ / "dados" / "conteudo" / "dados" / "rotulos" / "rotulos_minorias.json"
SAIDA = RAIZ / "saida"
REPO_HF = "unicamp-dl/PublicHearingBR"


def baixar_corpus() -> None:
    """Baixa o PublicHearingBR do Hugging Face na primeira execução."""
    if ARQUIVO_LDS.exists():
        return
    from huggingface_hub import hf_hub_download

    DIR_CORPUS.mkdir(parents=True, exist_ok=True)
    hf_hub_download(
        REPO_HF, ARQUIVO_LDS.name, repo_type="dataset", local_dir=DIR_CORPUS
    )


@lru_cache(maxsize=1)
def _audiencias() -> dict[int, dict]:
    baixar_corpus()
    with ARQUIVO_LDS.open(encoding="utf-8") as arquivo:
        return {a["id"]: a for a in map(json.loads, arquivo)}


def carregar_audiencia(audiencia_id: int) -> dict:
    """Devolve `id`, `transcricao`, `materia` e `metadados` (com `assunto`)."""
    return _audiencias()[audiencia_id]


def ids_minorias() -> list[int]:
    rotulos = json.loads(ARQUIVO_ROTULOS.read_text(encoding="utf-8"))
    return sorted({i for c in rotulos["categorias"].values() for i in c["ids"]})


def ler_ids(texto: str) -> list[int]:
    """Aceita `67`, `6,33,67`, `1-206`, `minorias` ou `comparacao`."""
    texto = texto.strip().lower()
    if texto == "minorias":
        return ids_minorias()
    if texto == "comparacao":
        m = set(ids_minorias())
        return [i for i in range(1, 207) if i not in m]
    ids: list[int] = []
    for parte in texto.split(","):
        parte = parte.strip()
        if "-" in parte:
            inicio, fim = parte.split("-", 1)
            ids.extend(range(int(inicio), int(fim) + 1))
        elif parte:
            ids.append(int(parte))
    return sorted(dict.fromkeys(ids))


def gravar_json(caminho: Path, dados) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
