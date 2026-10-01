"""Agrupamento das unidades em temas: embeddings locais e Ward hierárquico."""

import math

import numpy as np

from . import config

_modelos: dict[str, object] = {}


def embutir(textos: list[str]) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    nome = config.MODELO_EMBEDDINGS
    if nome not in _modelos:
        _modelos[nome] = SentenceTransformer(nome)
    vetores = _modelos[nome].encode(
        textos, normalize_embeddings=True, show_progress_bar=len(textos) > 50
    )
    return np.asarray(vetores, dtype=float)


def _renumerar(rotulos: np.ndarray) -> np.ndarray:
    """Renumera os grupos como 0, 1, 2... na ordem em que aparecem."""
    mapa: dict[int, int] = {}
    saida = np.empty_like(rotulos, dtype=int)
    for i, r in enumerate(rotulos.tolist()):
        saida[i] = mapa.setdefault(r, len(mapa))
    return saida


def _centroides(vetores: np.ndarray, rotulos: np.ndarray, grupos: list[int]) -> np.ndarray:
    saida = []
    for g in grupos:
        c = vetores[rotulos == g].mean(axis=0)
        n = np.linalg.norm(c)
        saida.append(c / n if n else c)
    return np.asarray(saida)


def _escore(vetores: np.ndarray, rotulos: np.ndarray) -> dict:
    """Silhueta (cosseno) penalizada por redundância, temas unitários e complexidade."""
    grupos = sorted(set(rotulos.tolist()))
    if len(grupos) == 1:
        return {"k": 1, "silhueta": 0.0, "max_similaridade_entre_temas": 0.0,
                "taxa_temas_unitarios": 0.0, "score": 0.0}

    distancias = np.clip(1.0 - vetores @ vetores.T, 0.0, 2.0)
    silhuetas: list[float] = []
    for i in range(len(rotulos)):
        mesmo = np.flatnonzero(rotulos == rotulos[i])
        if len(mesmo) <= 1:
            silhuetas.append(0.0)
            continue
        a = float(distancias[i, mesmo[mesmo != i]].mean())
        b = min(
            float(distancias[i, np.flatnonzero(rotulos == g)].mean())
            for g in grupos
            if g != rotulos[i]
        )
        silhuetas.append((b - a) / max(a, b, 1e-12))

    unitarios = sum(1 for g in grupos if np.sum(rotulos == g) == 1)
    centroides = _centroides(vetores, rotulos, grupos)
    sims = centroides @ centroides.T
    max_sim = float(np.max(sims[np.triu_indices(len(grupos), 1)]))
    silhueta = float(np.mean(silhuetas))
    redundancia = max(0.0, (max_sim - 0.72) / 0.28)
    taxa_unitarios = unitarios / len(grupos)
    score = (
        silhueta
        - config.PENALIDADE_REDUNDANCIA * redundancia
        - config.PENALIDADE_UNITARIO * taxa_unitarios
        - config.PENALIDADE_COMPLEXIDADE * (len(grupos) - 1)
    )
    return {
        "k": len(grupos),
        "silhueta": round(silhueta, 6),
        "max_similaridade_entre_temas": round(max_sim, 6),
        "taxa_temas_unitarios": round(taxa_unitarios, 6),
        "score": round(float(score), 6),
    }


def _fundir_parecidos(vetores, rotulos, *, min_grupos: int) -> tuple[np.ndarray, list[dict]]:
    """Une, um par por vez, os temas cujos centroides têm similaridade >= 0,82."""
    historico: list[dict] = []
    rotulos = _renumerar(rotulos)
    while len(set(rotulos.tolist())) > min_grupos:
        grupos = sorted(set(rotulos.tolist()))
        sims = _centroides(vetores, rotulos, grupos)
        sims = sims @ sims.T
        np.fill_diagonal(sims, -1.0)
        pares = sorted(
            ((float(sims[i, j]), i, j) for i in range(len(grupos)) for j in range(i + 1, len(grupos))),
            reverse=True,
        )
        escolhido = None
        for sim, i, j in pares:
            if sim < config.SIMILARIDADE_PARA_FUNDIR:
                break
            tamanho = int(np.sum(rotulos == grupos[i]) + np.sum(rotulos == grupos[j]))
            if tamanho <= config.MAX_UNIDADES_POR_TEMA:
                escolhido = (sim, i, j)
                break
        if escolhido is None:
            break
        sim, i, j = escolhido
        origem, destino = grupos[max(i, j)], grupos[min(i, j)]
        rotulos[rotulos == origem] = destino
        historico.append({"tema_origem": int(origem), "tema_destino": int(destino),
                          "similaridade": round(sim, 6)})
        rotulos = _renumerar(rotulos)
    return rotulos, historico


def escolher_temas(vetores: np.ndarray) -> tuple[np.ndarray, dict]:
    """Escolhe o número de temas e devolve o tema de cada unidade.

    Avalia os cortes da árvore de Ward com k entre k_min e k_max e fica com o menor
    k cujo escore está a até 0,03 do melhor. Depois une temas muito parecidos.
    """
    from scipy.cluster.hierarchy import fcluster, linkage

    vetores = np.asarray(vetores, dtype=float)
    n = len(vetores)
    if n == 0:
        return np.asarray([], dtype=int), {"k_escolhido": 0, "k_min": 0, "candidatos": [], "fusoes": []}
    vetores = vetores / np.maximum(np.linalg.norm(vetores, axis=1, keepdims=True), 1e-12)
    if n == 1 or float(np.max(1.0 - vetores @ vetores.T)) < 1e-9:
        return np.zeros(n, dtype=int), {"k_escolhido": 1, "k_min": 1, "candidatos": [], "fusoes": []}

    arvore = linkage(vetores, method="ward", metric="euclidean")
    if n < config.MIN_UNIDADES_PARA_SUBTEMAS:
        return np.zeros(n, dtype=int), {
            "k_escolhido": 1, "k_antes_fusoes": 1, "k_min": 1, "k_max": 1,
            "criterio": "poucas_unidades_para_subtemas", "candidatos": [], "fusoes": [],
        }

    k_min = min(n, config.MAX_TEMAS,
                max(config.MIN_TEMAS, math.ceil(n / config.MAX_UNIDADES_POR_TEMA)))
    alvo = math.ceil(n / config.UNIDADES_ALVO_POR_TEMA)
    k_max = min(n, config.MAX_CANDIDATOS, config.MAX_TEMAS, max(k_min, alvo + 2))

    candidatos = []
    for k in range(k_min, k_max + 1):
        rotulos = _renumerar(fcluster(arvore, t=k, criterion="maxclust"))
        candidatos.append((rotulos, _escore(vetores, rotulos)))
    melhor = max(c[1]["score"] for c in candidatos)
    elegiveis = [c for c in candidatos if c[1]["score"] >= melhor - config.TOLERANCIA_MELHOR_ESCORE]
    escolhidos, _ = min(elegiveis, key=lambda c: c[1]["k"])

    finais, fusoes = _fundir_parecidos(vetores, escolhidos.copy(), min_grupos=k_min)
    return finais, {
        "k_escolhido": len(set(finais.tolist())),
        "k_antes_fusoes": len(set(escolhidos.tolist())),
        "k_min": k_min,
        "k_max": k_max,
        "metodo": "ward_euclidiano_sobre_embeddings_normalizados",
        "criterio": "menor_k_na_faixa_dentro_da_tolerancia_do_melhor_score",
        "melhor_score": round(float(melhor), 6),
        "candidatos": [m for _, m in candidatos],
        "fusoes": fusoes,
    }


def agrupar_titulos(secoes: list[dict], vetores, *, min_componentes: int) -> tuple[list[list[int]], list[dict]]:
    """Junta seções cujos títulos têm similaridade >= 0,90, até 100 unidades."""
    pais = list(range(len(secoes)))
    tamanhos = [len(s["unidades"]) for s in secoes]
    n_componentes = len(secoes)

    def raiz(i: int) -> int:
        while pais[i] != i:
            pais[i] = pais[pais[i]]
            i = pais[i]
        return i

    fusoes: list[dict] = []
    pares = [
        (float(vetores[i] @ vetores[j]), i, j)
        for i in range(len(secoes))
        for j in range(i + 1, len(secoes))
        if float(vetores[i] @ vetores[j]) >= config.SIMILARIDADE_TITULOS_PARA_FUNDIR
    ]
    for sim, i, j in sorted(pares, reverse=True):
        ri, rj = raiz(i), raiz(j)
        if ri == rj or n_componentes <= min_componentes:
            continue
        if tamanhos[ri] + tamanhos[rj] > config.MAX_UNIDADES_APOS_FUSAO:
            continue
        destino, origem = min(ri, rj), max(ri, rj)
        pais[origem] = destino
        tamanhos[destino] += tamanhos[origem]
        n_componentes -= 1
        fusoes.append({"secao_a": secoes[i]["id"], "secao_b": secoes[j]["id"],
                       "similaridade_titulos": round(sim, 6)})

    componentes: dict[int, list[int]] = {}
    for i in range(len(secoes)):
        componentes.setdefault(raiz(i), []).append(i)
    return list(componentes.values()), fusoes
