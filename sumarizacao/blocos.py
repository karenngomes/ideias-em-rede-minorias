"""Entrada da sumarização: blocos de fala da transcrição reduzida e suas âncoras."""

import csv
import difflib
import gzip
import re
import sys
from dataclasses import asdict, dataclass, replace
from pathlib import Path

from comum.turnos import slug, titulo

from . import config

ARQUIVO_REDUCAO = Path(__file__).resolve().parent / "dados" / "simplificacao.csv.gz"

CABECALHO_RE = re.compile(r"(?m)^-\s+(?P<cabecalho>[^\r\n]+?):[ \t]*$")
UF = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO"
PAPEL_RE = re.compile(
    r"^(?P<papel>PRESIDENTE|PRESIDENTA|RELATOR|RELATORA|SECRETARIO|SECRETÁRIO)\s*"
    r"(?:\((?P<paren>.*)\))?$",
    re.IGNORECASE,
)
FILIACAO_RE = re.compile(
    rf"^(?P<nome>.+?)\.\s*(?P<partido>[^.]+?\s*-\s*(?:{UF}))$", re.IGNORECASE
)
NOME_COM_PAREN_RE = re.compile(r"^(?P<nome>.*?)\s*\((?P<paren>[^()]*)\)$")


@dataclass(frozen=True)
class Bloco:
    id: str
    sample_id: int
    ordem: int
    falante_raw: str
    falante: str
    papel: str | None
    partido: str | None
    texto: str
    char_start: int  # offsets no campo `falas_resumidas_str` do CSV
    char_end: int

    def to_dict(self) -> dict:
        return asdict(self)


def contador_tokens():
    import tiktoken

    codificador = tiktoken.get_encoding("cl100k_base")
    return lambda texto: len(codificador.encode(texto))


def ler_reducao(ids: list[int]) -> dict[int, str]:
    """Lê `id,falas_resumidas_str` da transcrição reduzida."""
    csv.field_size_limit(min(sys.maxsize, 100 * 1024 * 1024))
    saida: dict[int, str] = {}
    with gzip.open(ARQUIVO_REDUCAO, "rt", encoding="utf-8-sig", newline="") as arquivo:
        for linha in csv.DictReader(arquivo):
            if int(linha["id"]) in ids:
                saida[int(linha["id"])] = linha["falas_resumidas_str"]
    faltando = sorted(set(ids) - saida.keys())
    if faltando:
        raise KeyError(f"audiências ausentes da redução: {faltando}")
    return saida


def _aparar(texto: str, inicio: int, fim: int) -> tuple[str, int, int]:
    trecho = texto[inicio:fim]
    esquerda = len(trecho) - len(trecho.lstrip())
    direita = len(trecho.rstrip())
    return trecho[esquerda:direita], inicio + esquerda, inicio + direita


def _ler_cabecalho(cabecalho: str) -> tuple[str, str | None, str | None, str | None]:
    """(falante, papel, partido, nome civil) a partir de `- FALANTE:`."""
    bruto = " ".join(cabecalho.split()).strip()
    m = PAPEL_RE.match(bruto)
    if not m:
        com_paren = NOME_COM_PAREN_RE.match(bruto)
        if not com_paren:
            return titulo(bruto), None, None, None
        paren = com_paren.group("paren").strip()
        partido = paren if re.search(rf"-\s*(?:{UF})$", paren, re.I) else None
        return titulo(com_paren.group("nome")), None, partido, None
    papel = m.group("papel").upper()
    paren = (m.group("paren") or "").strip()
    if not paren:
        return titulo(papel), papel, None, None
    filiacao = FILIACAO_RE.match(paren)
    if filiacao:
        nome = filiacao.group("nome").strip()
        if nome.isupper():
            nome = titulo(nome)
        return nome, papel, filiacao.group("partido").strip(), nome
    nome = titulo(paren) if paren.isupper() else paren
    return nome, papel, None, nome


def segmentar_reducao(texto: str, sample_id: int) -> list[Bloco]:
    matches = list(CABECALHO_RE.finditer(texto))
    if not matches:
        raise ValueError(f"audiência {sample_id}: nenhum cabeçalho '- FALANTE:'")

    brutos: list[dict] = []
    papeis: dict[str, str] = {}
    for i, m in enumerate(matches):
        fim = matches[i + 1].start() if i + 1 < len(matches) else len(texto)
        conteudo, inicio_texto, fim_texto = _aparar(texto, m.end(), fim)
        falante, papel, partido, civil = _ler_cabecalho(m.group("cabecalho"))
        if papel and civil:
            papeis.setdefault(papel, civil)
        brutos.append(
            {
                "falante_raw": m.group("cabecalho").strip(),
                "falante": falante,
                "papel": papel,
                "partido": partido,
                "texto": conteudo,
                "char_start": inicio_texto,
                "char_end": fim_texto,
            }
        )

    blocos: list[Bloco] = []
    for ordem, b in enumerate(brutos, start=1):
        if b["papel"] and b["falante"] == titulo(b["papel"]):
            b["falante"] = papeis.get(b["papel"], b["falante"])
        if b["texto"]:
            blocos.append(
                Bloco(id=f"b::{sample_id:03d}::{ordem:04d}", sample_id=sample_id, ordem=ordem, **b)
            )
    return blocos


def _cortes(texto: str, max_tokens: int, contar) -> list[tuple[int, int]]:
    """Divide um texto longo em fronteiras de parágrafo ou de sentença."""
    if contar(texto) <= max_tokens:
        return [(0, len(texto))]
    limites = [m.end() for m in re.finditer(r"\n\s*\n|(?<=[.!?])\s+", texto)]
    limites.append(len(texto))
    partes: list[tuple[int, int]] = []
    inicio = ultimo_bom = 0
    for limite in limites:
        if limite <= inicio:
            continue
        if contar(texto[inicio:limite]) <= max_tokens:
            ultimo_bom = limite
            continue
        if ultimo_bom > inicio:
            partes.append((inicio, ultimo_bom))
            inicio = ultimo_bom
            if contar(texto[inicio:limite]) <= max_tokens:
                ultimo_bom = limite
                continue
        # Sentença maior que o limite: busca binária pelo maior corte possível.
        while contar(texto[inicio:limite]) > max_tokens:
            baixo, alto = inicio + 1, limite
            while baixo < alto:
                meio = (baixo + alto + 1) // 2
                if contar(texto[inicio:meio]) <= max_tokens:
                    baixo = meio
                else:
                    alto = meio - 1
            corte = max(baixo, inicio + 1)
            partes.append((inicio, corte))
            inicio = corte
        ultimo_bom = limite
    if inicio < len(texto):
        partes.append((inicio, len(texto)))
    return partes


def fatiar(blocos: list[Bloco], contar) -> list[Bloco]:
    """Blocos acima de MAX_TOKENS_BLOCO viram vários, com sufixo `.01`, `.02`..."""
    saida: list[Bloco] = []
    for bloco in blocos:
        cortes = _cortes(bloco.texto, config.MAX_TOKENS_BLOCO, contar)
        for indice, (inicio, fim) in enumerate(cortes, start=1):
            trecho, ini, fi = _aparar(bloco.texto, inicio, fim)
            if not trecho:
                continue
            sufixo = f".{indice:02d}" if len(cortes) > 1 else ""
            saida.append(
                replace(
                    bloco,
                    id=bloco.id + sufixo,
                    texto=trecho,
                    char_start=bloco.char_start + ini,
                    char_end=bloco.char_start + fi,
                )
            )
    return saida


def formar_lotes(blocos: list[Bloco], contar) -> list[list[Bloco]]:
    """Agrupa os blocos por falante, na ordem em que ocorrem."""
    por_falante: dict[str, list[Bloco]] = {}
    for bloco in blocos:
        por_falante.setdefault(slug(bloco.falante), []).append(bloco)

    lotes: list[list[Bloco]] = []
    for blocos_do_falante in por_falante.values():
        atual: list[Bloco] = []
        tokens = 0
        for bloco in blocos_do_falante:
            custo = contar(bloco.texto) + 30
            if atual and (
                tokens + custo > config.MAX_TOKENS_LOTE or len(atual) >= config.MAX_BLOCOS_LOTE
            ):
                lotes.append(atual)
                atual, tokens = [], 0
            atual.append(bloco)
            tokens += custo
        if atual:
            lotes.append(atual)
    return lotes


def localizar_no_bloco(texto: str, ancora: str, offset: int = 0) -> dict:
    """Aceita a âncora só se for literal e única no bloco.

    Se não ocorrer, aceita o maior trecho literal dela com ao menos 40 caracteres
    e 80% do tamanho; o offset continua apontando para texto exato da fonte.
    """
    if not ancora:
        return {"status": "ausente", "char_start": None, "char_end": None, "candidatos": []}
    candidatos = [
        {"char_start": offset + m.start(), "char_end": offset + m.end()}
        for m in re.finditer(re.escape(ancora), texto)
    ]
    if len(candidatos) == 1:
        return {"status": "exata", **candidatos[0], "candidatos": candidatos, "trecho_resolvido": ancora}
    if not candidatos:
        m = difflib.SequenceMatcher(None, ancora, texto, autojunk=False).find_longest_match()
        if m.size >= config.ANCORA_MIN_CARACTERES and m.size / len(ancora) >= config.ANCORA_MIN_FRACAO:
            candidato = {"char_start": offset + m.b, "char_end": offset + m.b + m.size}
            return {
                "status": "exata_recortada",
                **candidato,
                "candidatos": [candidato],
                "trecho_resolvido": texto[m.b : m.b + m.size],
            }
    return {
        "status": "ambigua" if candidatos else "nao_encontrada",
        "char_start": None,
        "char_end": None,
        "candidatos": candidatos,
        "trecho_resolvido": None,
    }


def localizar_no_original(ancora: str, falante: str, transcricao: str, turnos) -> dict:
    """Procura a âncora nos turnos do mesmo falante e, depois, na transcrição inteira."""
    if not ancora:
        return {"status": "ausente", "char_start": None, "char_end": None, "turno_id": None, "candidatos": []}
    alvo = slug(falante)
    no_falante = [
        {
            "char_start": t.char_start + m.start(),
            "char_end": t.char_start + m.end(),
            "turno_id": t.turno_id,
        }
        for t in turnos
        if slug(t.falante_norm) == alvo
        for m in re.finditer(re.escape(ancora), transcricao[t.char_start : t.char_end])
    ]
    if len(no_falante) == 1:
        return {"status": "exata_no_falante", **no_falante[0], "candidatos": no_falante}
    globais = [
        {"char_start": m.start(), "char_end": m.end(), "turno_id": None}
        for m in re.finditer(re.escape(ancora), transcricao)
    ]
    if len(globais) == 1:
        return {"status": "exata_global", **globais[0], "candidatos": globais}
    candidatos = no_falante or globais
    return {
        "status": "ambigua" if candidatos else "nao_encontrada",
        "char_start": None,
        "char_end": None,
        "turno_id": None,
        "candidatos": candidatos,
    }
