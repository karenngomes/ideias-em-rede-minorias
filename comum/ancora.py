"""Localização de trechos citados pelo modelo dentro da fala."""

from .turnos import Turno


def _denso(texto: str) -> tuple[str, list[int]]:
    """Texto sem espaços em branco e o mapa de volta para os offsets originais."""
    mapa = [i for i, c in enumerate(texto) if not c.isspace()]
    return "".join(texto[i] for i in mapa), mapa


def _minusculo(texto: str) -> str:
    """Minúsculas sem mudar o comprimento do texto."""
    return "".join(c.lower() if len(c.lower()) == 1 else c for c in texto)


def localizar(trecho: str, texto: str) -> tuple[int, int] | None:
    """Acha `trecho` em `texto`, tolerando só espaço em branco e caixa.

    Acento e pontuação têm de ser iguais. Devolve (início, fim) em `texto`.
    """
    denso_trecho, _ = _denso(trecho)
    if not denso_trecho:
        return None
    denso, mapa = _denso(texto)
    pos = _minusculo(denso).find(_minusculo(denso_trecho))
    if pos == -1:
        return None
    return mapa[pos], mapa[pos + len(denso_trecho) - 1] + 1


def inicio_do_corpo(turno: Turno, transcricao: str) -> int:
    """Offset, na transcrição, de onde começa o texto do turno (após o cabeçalho)."""
    return transcricao.find(turno.texto, turno.char_start)
