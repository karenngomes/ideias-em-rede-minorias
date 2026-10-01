"""Sumarização ancorada das audiências.

    python -m sumarizacao.rodar --audiencias 67
    python -m sumarizacao.rodar --audiencias minorias

Etapas para cada audiência:
  1. divide a transcrição reduzida em blocos de fala e agrupa em lotes por falante;
  2. o modelo extrai unidades substantivas, cada uma com uma âncora literal;
  3. o código descarta unidades cuja âncora não está no bloco e alinha as demais
     à transcrição original;
  4. as unidades são agrupadas em temas (embeddings + Ward);
  5. o modelo escreve uma seção por tema, e cada frase indica de quais unidades deriva;
  6. o código descarta frases sem derivação válida e junta seções de títulos redundantes.
"""

import argparse
import re
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from comum.corpus import RAIZ, SAIDA, carregar_audiencia, gravar_json, ler_ids
from comum.turnos import segmentar

from . import config
from .blocos import (
    contador_tokens,
    fatiar,
    formar_lotes,
    ler_reducao,
    localizar_no_bloco,
    localizar_no_original,
    segmentar_reducao,
)
from .cliente import ClienteResponses
from .temas import agrupar_titulos, embutir, escolher_temas

PROMPTS = Path(__file__).resolve().parent / "prompts"
DESTINO = SAIDA / "sumarizacao"
CACHE = RAIZ / ".cache" / "sumarizacao"

FUNCOES = ["informar", "perguntar", "responder", "pedir", "sugerir", "comprometer_se",
           "concordar", "discordar", "corrigir", "outro"]
PAPEIS_ARGUMENTATIVOS = ["tese", "justificativa", "evidencia", "nenhum", "outro"]
MARCADORES = ["denuncia", "contraponto", "ressalva", "relato_pessoal", "previsao", "demanda"]


def _prompt(arquivo: str, **valores) -> str:
    texto = (PROMPTS / arquivo).read_text(encoding="utf-8")
    for chave, valor in valores.items():
        texto = texto.replace(f"<<{chave}>>", str(valor))
    if re.search(r"<<([^>]+)>>", texto):
        raise ValueError(f"campos sem valor em {arquivo}")
    return texto


def _schema_extracao(ids_blocos: list[str]) -> dict:
    unidade = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "funcao_comunicativa": {"type": "string", "enum": FUNCOES},
            "papel_argumentativo": {"type": "string", "enum": PAPEIS_ARGUMENTATIVOS},
            "marcadores": {"type": "array", "items": {"type": "string", "enum": MARCADORES}},
            "descricao_outro": {"type": "string"},
            "texto": {"type": "string"},
            "trecho_ancora": {"type": "string"},
        },
        "required": ["funcao_comunicativa", "papel_argumentativo", "marcadores",
                     "descricao_outro", "texto", "trecho_ancora"],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "blocos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "bloco_id": {"type": "string", "enum": ids_blocos},
                        "unidades": {"type": "array", "items": unidade},
                    },
                    "required": ["bloco_id", "unidades"],
                },
            }
        },
        "required": ["blocos"],
    }


def _schema_sintese(ids_unidades: list[str]) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "titulo": {"type": "string"},
            "frases": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "texto": {"type": "string"},
                        "deriva_de": {"type": "array", "items": {"type": "string", "enum": ids_unidades}},
                    },
                    "required": ["texto", "deriva_de"],
                },
            },
        },
        "required": ["titulo", "frases"],
    }


# ------------------------------------------------------------------ extração
def _extrair_lote(cliente, sample_id: int, lote) -> list[dict]:
    blocos_txt = "\n\n".join(
        f"[{b.id} | falante: {b.falante} | chars: {b.char_start}-{b.char_end}]\n{b.texto}"
        for b in lote
    )
    data = cliente.gerar_json(
        prompt=_prompt("extrair_unidades.md", sample_id=sample_id, blocos=blocos_txt),
        modelo=config.MODELO_EXTRACAO,
        schema_nome="unidades_substantivas",
        schema=_schema_extracao([b.id for b in lote]),
        esforco=config.ESFORCO_EXTRACAO,
        max_saida=config.MAX_SAIDA_EXTRACAO,
    )
    recebidos = [item.get("bloco_id") for item in data.get("blocos", [])]
    esperados = [b.id for b in lote]
    if sorted(recebidos) != sorted(esperados) or len(recebidos) != len(set(recebidos)):
        raise ValueError(f"o modelo não devolveu cada bloco exatamente uma vez: {recebidos}")
    return data["blocos"]


def _extrair(cliente, sample_id: int, lote) -> list[dict]:
    """Se um lote falhar, divide-o ao meio até isolar o bloco problemático."""
    try:
        return _extrair_lote(cliente, sample_id, lote)
    except Exception:
        if len(lote) == 1:
            raise
        meio = len(lote) // 2
        return _extrair(cliente, sample_id, lote[:meio]) + _extrair(cliente, sample_id, lote[meio:])


def _ancorar(dados: list[dict], blocos, sample_id: int, transcricao: str, turnos) -> list[dict]:
    por_id = {b.id: b for b in blocos}
    unidades: list[dict] = []
    for resultado in dados:
        bloco = por_id[resultado["bloco_id"]]
        for bruta in resultado["unidades"]:
            ancora_modelo = bruta["trecho_ancora"]
            no_bloco = localizar_no_bloco(bloco.texto, ancora_modelo, bloco.char_start)
            ancora = no_bloco.get("trecho_resolvido") or ancora_modelo
            unidades.append(
                {
                    "id": f"u::{sample_id:03d}::{len(unidades) + 1:05d}",
                    "sample_id": sample_id,
                    "bloco_id": bloco.id,
                    "ordem_bloco": bloco.ordem,
                    "falante": bloco.falante,
                    "papel": bloco.papel,
                    "partido": bloco.partido,
                    **{**bruta, "trecho_ancora": ancora},
                    "trecho_ancora_modelo": ancora_modelo,
                    "ancora_simplificacao": no_bloco,
                    "ancora_original": localizar_no_original(ancora, bloco.falante, transcricao, turnos),
                }
            )
    return unidades


# ------------------------------------------------------------------ síntese
def _sintetizar(cliente, sample_id: int, tema_id: str, unidades: list[dict]) -> dict:
    linhas = []
    for u in unidades:
        classe = f"{u['funcao_comunicativa']}/{u['papel_argumentativo']}"
        if u["marcadores"]:
            classe += f"; {', '.join(u['marcadores'])}"
        linhas.append(
            f"[{u['id']}] {u['falante']} ({classe}): {u['texto']}\n"
            f"Evidência literal: {u['trecho_ancora']}"
        )
    ids = [u["id"] for u in unidades]
    data = cliente.gerar_json(
        prompt=_prompt("sintetizar_tema.md", sample_id=sample_id, tema_id=tema_id,
                       unidades="\n\n".join(linhas)),
        modelo=config.MODELO_SINTESE,
        schema_nome="sintese_tematica",
        schema=_schema_sintese(ids),
        esforco=config.ESFORCO_SINTESE,
        max_saida=config.MAX_SAIDA_SINTESE,
    )
    frases = []
    for frase in data["frases"]:
        origens = list(dict.fromkeys(frase["deriva_de"]))
        if origens and set(origens) <= set(ids) and frase["texto"].strip():
            frases.append({"texto": frase["texto"].strip(), "deriva_de": origens})
    if not frases:
        raise ValueError(f"tema {tema_id}: síntese sem frases válidas")
    return {
        "id": tema_id,
        "titulo": data["titulo"].strip() or "Tema sem título",
        "frases": frases,
        "unidades": ids,
        "unidades_citadas": sorted({i for f in frases for i in f["deriva_de"]}),
        "participantes": list(dict.fromkeys(u["falante"] for u in unidades)),
    }


def _temas_e_secoes(cliente, sample_id: int, unidades: list[dict]) -> tuple[list[dict], dict]:
    if not unidades:
        return [], {"k_escolhido": 0, "k_min": 0, "candidatos": [], "fusoes": [],
                    "fusoes_pos_sintese": [], "k_final": 0}

    textos = [f"{u['funcao_comunicativa']} | {u['papel_argumentativo']} | {u['texto']}" for u in unidades]
    rotulos, diagnostico = escolher_temas(embutir(textos))
    grupos: dict[int, list[dict]] = {}
    for u, r in zip(unidades, rotulos):
        grupos.setdefault(int(r), []).append(u)
    grupos_ordenados = sorted(grupos.values(), key=lambda g: min(u["ordem_bloco"] for u in g))

    tema_id = lambda i: f"t::{sample_id:03d}::{i:02d}"  # noqa: E731
    with ThreadPoolExecutor(max_workers=config.MAX_PARALELO) as pool:
        secoes = list(
            pool.map(
                lambda par: _sintetizar(cliente, sample_id, tema_id(par[0]), par[1]),
                enumerate(grupos_ordenados, start=1),
            )
        )

    fusoes: list[dict] = []
    if len(secoes) > 1:
        componentes, fusoes = agrupar_titulos(
            secoes, embutir([s["titulo"] for s in secoes]), min_componentes=diagnostico.get("k_min", 1)
        )
        if fusoes:
            por_id = {u["id"]: u for u in unidades}
            novas = []
            for i, comp in enumerate(componentes, start=1):
                if len(comp) == 1:
                    novas.append({**secoes[comp[0]], "id": tema_id(i)})
                    continue
                ids = list(dict.fromkeys(uid for p in comp for uid in secoes[p]["unidades"]))
                grupo = sorted((por_id[uid] for uid in ids), key=lambda u: (u["ordem_bloco"], u["id"]))
                novas.append(_sintetizar(cliente, sample_id, tema_id(i), grupo))
            secoes = novas
    diagnostico["fusoes_pos_sintese"] = fusoes
    diagnostico["k_final"] = len(secoes)
    return secoes, diagnostico


# ------------------------------------------------------------------ audiência
def sumarizar(cliente, sample_id: int, reducao: str) -> dict:
    contar = contador_tokens()
    blocos = fatiar(segmentar_reducao(reducao, sample_id), contar)
    lotes = formar_lotes(blocos, contar)

    with ThreadPoolExecutor(max_workers=config.MAX_PARALELO) as pool:
        partes = list(pool.map(lambda lote: _extrair(cliente, sample_id, lote), lotes))
    ordem = {b.id: i for i, b in enumerate(blocos)}
    dados = sorted((item for parte in partes for item in parte), key=lambda d: ordem[d["bloco_id"]])

    audiencia = carregar_audiencia(sample_id)
    transcricao = audiencia["transcricao"]
    extraidas = _ancorar(dados, blocos, sample_id, transcricao, segmentar(transcricao))
    aceitas = [u for u in extraidas if u["ancora_simplificacao"]["status"].startswith("exata")]
    rejeitadas = [u for u in extraidas if not u["ancora_simplificacao"]["status"].startswith("exata")]

    secoes, diagnostico = _temas_e_secoes(cliente, sample_id, aceitas)

    def taxa(n: int) -> float:
        return round(n / len(aceitas), 6) if aceitas else 1.0

    exatas_reducao = sum(u["ancora_simplificacao"]["status"].startswith("exata") for u in aceitas)
    exatas_original = sum(u["ancora_original"]["status"].startswith("exata") for u in aceitas)
    citadas = {i for s in secoes for f in s["frases"] for i in f["deriva_de"]}
    resumo = {
        "sample_id": sample_id,
        "assunto": audiencia["metadados"].get("assunto", ""),
        "secoes": secoes,
        "cobertura": {
            "blocos": len(blocos),
            "unidades": len(aceitas),
            "unidades_rejeitadas_sem_ancora": len(rejeitadas),
            "unidades_ancora_exata_simplificacao": exatas_reducao,
            "taxa_ancora_exata_simplificacao": taxa(exatas_reducao),
            "unidades_ancora_exata_original": exatas_original,
            "taxa_ancora_exata_original": taxa(exatas_original),
            "unidades_associadas_a_tema": sum(len(s["unidades"]) for s in secoes),
            "unidades_citadas_na_sintese": len(citadas),
            "taxa_unidades_citadas_na_sintese": taxa(len(citadas)),
        },
        "selecao_temas": diagnostico,
    }
    pasta = DESTINO / f"{sample_id:03d}"
    gravar_json(pasta / "unidades.json", aceitas)
    gravar_json(pasta / "unidades_rejeitadas.json", rejeitadas)
    gravar_json(pasta / "resumo.json", resumo)
    return resumo


def main() -> int:
    ap = argparse.ArgumentParser(description="Sumarização ancorada.")
    ap.add_argument("--audiencias", default="67", help="67 | 6,33,67 | 1-206 | minorias | comparacao")
    ap.add_argument("--cache", default=str(CACHE), help="pasta do cache de respostas")
    ap.add_argument("--refazer", action="store_true", help="refaz audiências já processadas")
    args = ap.parse_args()

    ids = ler_ids(args.audiencias)
    reducoes = ler_reducao(ids)
    cliente = ClienteResponses(Path(args.cache))
    falhas = 0
    for n, sid in enumerate(ids, start=1):
        if not args.refazer and (DESTINO / f"{sid:03d}" / "resumo.json").exists():
            print(f"[{n}/{len(ids)}] {sid}: já feita")
            continue
        try:
            resumo = sumarizar(cliente, sid, reducoes[sid])
            print(f"[{n}/{len(ids)}] {sid}: {resumo['cobertura']['unidades']} unidades, "
                  f"{len(resumo['secoes'])} temas")
        except Exception:
            falhas += 1
            print(f"[{n}/{len(ids)}] {sid}: FALHOU\n{traceback.format_exc()}")
    print(f"Saída em {DESTINO}")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())
