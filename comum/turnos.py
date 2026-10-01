"""Segmentação da transcrição em turnos de fala, sem modelo de linguagem.

Cada turno começa com um cabeçalho em caixa alta no início da linha:

    O SR. PRESIDENTE (Orlando Silva. PCdoB - SP) - Hoje nós temos...
    A SRA. ALINE PAZ - Obrigada, Presidente.

O falante de "PRESIDENTE" é resolvido para o nome civil revelado no parêntese.
"""

import re
import unicodedata
from dataclasses import asdict, dataclass

TURNO_RE = re.compile(
    r"^(?P<trat>O SR\.|A SRA\.|O SR|A SRA)"
    r"\s*(?P<nome>[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ0-9º°.\s]+?)"
    r"\s*(?:\((?P<paren>[^)]*)\))?"
    r"\s*-\s",
    re.MULTILINE,
)

PAPEIS = {"PRESIDENTE", "PRESIDENTA", "RELATOR", "RELATORA", "SECRETARIO", "SECRETÁRIO"}
PAPEIS_MESA = frozenset({"PRESIDENTE", "PRESIDENTA"})

UF = (
    "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|"
    "RJ|RN|RS|RO|RR|SC|SP|SE|TO"
)

# "Orlando Silva. PCdoB - SP" -> nome civil e partido.
PAREN_COM_NOME_RE = re.compile(
    rf"^(?P<nome>.*?[a-záâãàéêíóôõúüç].*?)\.\s*(?P<partido>[^.]+?-\s*(?:{UF}))\s*$"
)

# Filiação partidária terminada em UF: separa parlamentar de convidado.
PARLAMENTAR_RE = re.compile(rf"-\s*(?:{UF})\s*$")


def slug(nome: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", nome) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", sem_acento.lower()).strip()


def titulo(nome: str) -> str:
    minusculas = {"de", "da", "do", "das", "dos", "e", "van", "von", "del", "di", "du", "la"}
    partes = nome.split()
    return " ".join(
        p.lower() if i and p.lower() in minusculas else p.capitalize()
        for i, p in enumerate(partes)
    )


@dataclass
class Turno:
    turno_id: int
    falante_raw: str
    falante_norm: str
    papel: str | None
    partido: str | None
    texto: str
    char_start: int  # início do cabeçalho na transcrição original
    char_end: int

    @property
    def chunk_id(self) -> str:
        return f"turno_{self.turno_id:04d}"

    def como_chunk(self) -> str:
        return f"[{self.chunk_id} | {self.falante_norm}]\n{self.texto}"

    @property
    def da_mesa(self) -> bool:
        return (self.papel or "").upper() in PAPEIS_MESA

    def to_dict(self) -> dict:
        return asdict(self)


def segmentar(transcricao: str) -> list[Turno]:
    matches = list(TURNO_RE.finditer(transcricao))
    if not matches:
        return []

    brutos: list[dict] = []
    papel_para_nome: dict[str, str] = {}
    for i, m in enumerate(matches):
        nome_raw = " ".join(m.group("nome").split()).strip(" .")
        paren = (m.group("paren") or "").strip()
        partido = paren or None
        nome_civil = None
        if paren:
            casou = PAREN_COM_NOME_RE.match(paren)
            if casou:
                nome_civil = casou.group("nome").strip()
                partido = casou.group("partido").strip()

        papel = nome_raw if nome_raw in PAPEIS else None
        if papel and nome_civil:
            papel_para_nome.setdefault(papel, nome_civil)

        fim = matches[i + 1].start() if i + 1 < len(matches) else len(transcricao)
        brutos.append(
            {
                "nome_raw": nome_raw,
                "papel": papel,
                "nome_civil": nome_civil,
                "partido": partido,
                "texto": transcricao[m.end() : fim].strip(),
                "char_start": m.start(),
                "char_end": fim,
            }
        )

    turnos: list[Turno] = []
    for idx, b in enumerate(brutos, start=1):
        if b["nome_civil"]:
            falante = b["nome_civil"]
        elif b["papel"] and b["papel"] in papel_para_nome:
            falante = papel_para_nome[b["papel"]]
        else:
            falante = titulo(b["nome_raw"])
        turnos.append(
            Turno(
                turno_id=idx,
                falante_raw=b["nome_raw"],
                falante_norm=falante,
                papel=b["papel"],
                partido=b["partido"],
                texto=b["texto"],
                char_start=b["char_start"],
                char_end=b["char_end"],
            )
        )
    return turnos


def falantes(turnos: list[Turno]) -> dict[str, list[int]]:
    """Falante -> ids dos seus turnos, fundindo grafias com o mesmo slug."""
    registro: dict[str, list[int]] = {}
    canonico: dict[str, str] = {}
    for t in turnos:
        chave = slug(t.falante_norm)
        canonico.setdefault(chave, t.falante_norm)
        registro.setdefault(canonico[chave], []).append(t.turno_id)
    return registro


def eh_parlamentar(turnos: list[Turno]) -> dict[str, bool]:
    """Parlamentar é quem tem, em algum cabeçalho, filiação partidária com UF."""
    saida: dict[str, bool] = {}
    for t in turnos:
        atual = bool(t.partido and PARLAMENTAR_RE.search(t.partido))
        saida[t.falante_norm] = saida.get(t.falante_norm, False) or atual
    return saida
