"""Testes estatísticos para as hipóteses do painel Minorias × demais.

A numeração segue as hipóteses da Thalia: H1 interrupções, H2 conteúdo da
justificação, H3 nível de justificação, H4 respeito e H5 persuasão (análise do
David). A cobertura na matéria entra como análise complementar. Os testes são
exploratórios: as hipóteses podem ter sido formuladas depois de olhar os dados.

Lê o pacote da Thalia (dados/conteudo/dados) e a classificação de persuasão do
David (frontend/data/persuasao-por-audiencia.json) e imprime um teste por
hipótese. Resultados preliminares: o DQI e a persuasão vêm de LLM e ainda não
passaram por validação humana.

    python3 analises/testes_estatisticos.py

Além de imprimir, grava frontend/data/testes-estatisticos.json, que o painel
/comparacao exibe. Rode de novo sempre que os dados mudarem.

Requer numpy, scipy, pandas e statsmodels.
"""

import json
from itertools import combinations
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dados" / "conteudo" / "dados"
RNG = np.random.default_rng(20260929)
OUTPUT = ROOT / "frontend" / "data" / "testes-estatisticos.json"
N_PERM = 10_000  # reamostragens do bootstrap


def load():
    indice = {item["sample_id"]: item for item in json.loads((DATA / "indice_audiencias.json").read_text())}
    turnos, audiencias = [], []
    for sid, item in indice.items():
        folder = DATA / "audiencias" / f"audiencia_{sid:03d}"
        cobertura = json.loads((folder / "cobertura.json").read_text())
        dqi = json.loads((folder / "dqi.json").read_text())
        papel = {f["nome"]: "preside" if f["mesa"] else "parlamentar" if f["parlamentar"] else "convidado" for f in cobertura["falantes"]}
        for codigo in dqi["codigos"]:
            if codigo["dimensao"] == "participacao" and codigo["falante"] in papel:
                turnos.append({"audiencia": sid, "grupo": item["grupo"], "papel": papel[codigo["falante"]],
                               "interrompido": int(codigo["rotulo"] == "interrompido")})
        respeito = [c for c in dqi["codigos"] if c["dimensao"].startswith("respeito_")]
        conteudo = [c for c in dqi["codigos"] if c["dimensao"] == "justificacao_conteudo"]
        nivel = [c["nivel"] for c in dqi["codigos"] if c["dimensao"] == "justificacao_nivel"]
        audiencias.append({
            "audiencia": sid,
            "grupo": item["grupo"],
            "palavras": sum(f["n_palavras"] for f in cobertura["falantes"]),
            "respeito_positivo": np.mean([c["rotulo"] in ("explicito_positivo", "valoriza") for c in respeito]) if respeito else np.nan,
            "algum_negativo": int(any(c["rotulo"] in ("negativo", "degradante") for c in respeito)),
            # Nível médio de respeito, de 0 (negativo) a 1 (explícito positivo / valoriza).
            "respeito_medio": np.mean([c["nivel"] / (3 if c["dimensao"] == "respeito_contra" else 2) for c in respeito]) if respeito else np.nan,
            "bem_comum_diferenca": np.mean([c["rotulo"] == "bem_comum_diferenca" for c in conteudo]) if conteudo else np.nan,
            "interesse_de_grupo": np.mean([c["rotulo"] == "interesse_de_grupo" for c in conteudo]) if conteudo else np.nan,
            "nivel_justificacao": np.mean(nivel) if nivel else np.nan,
            "deficit_civil": cobertura["proporcoes"]["com_mesa"]["deficit_civil"],
        })
    return pd.DataFrame(turnos), pd.DataFrame(audiencias)


def exact_permutation_diff(a, b):
    """Diferença de médias e p bilateral exato, enumerando todas as divisões dos grupos."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    pooled = np.concatenate([a, b])
    observed = a.mean() - b.mean()
    total = pooled.sum()
    splits = np.array(list(combinations(range(len(pooled)), len(a))))
    sums = pooled[splits].sum(axis=1)
    diffs = sums / len(a) - (total - sums) / len(b)
    return observed, float(np.mean(np.abs(diffs) >= abs(observed) - 1e-12))


def bootstrap_ci(a, b, statistic=np.median):
    """Intervalo de 95% por bootstrap para statistic(a) − statistic(b)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    diffs = [statistic(RNG.choice(a, len(a))) - statistic(RNG.choice(b, len(b))) for _ in range(N_PERM)]
    return np.percentile(diffs, [2.5, 97.5])


def rank_biserial(a, b):
    """Tamanho de efeito do Mann-Whitney (−1 a 1; positivo: a tende a ser maior)."""
    u = stats.mannwhitneyu(a, b, alternative="two-sided").statistic
    return 2 * u / (len(a) * len(b)) - 1


def holm(pvalues):
    order = np.argsort(pvalues)
    adjusted = np.empty(len(pvalues))
    running = 0.0
    for rank, index in enumerate(order):
        running = max(running, (len(pvalues) - rank) * pvalues[index])
        adjusted[index] = min(1.0, running)
    return adjusted


def h1(turnos):
    print("\nH1 · Interrupções (GEE logístico, falas agrupadas por audiência)")
    data = turnos[turnos.papel.isin(["convidado", "parlamentar"])].copy()
    data["convidado"] = (data.papel == "convidado").astype(int)
    data["minorias"] = (data.grupo == "M").astype(int)
    model = smf.gee("interrompido ~ convidado * minorias", groups="audiencia", data=data,
                    family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
    odds = np.exp(model.params)
    ci = np.exp(model.conf_int())
    result = {"teste": "Regressão logística com GEE (falas agrupadas por audiência)", "n_falas": int(len(data))}
    for term, key, label in [("convidado", "convidado", "convidado × parlamentar (nas demais)"),
                             ("convidado:minorias", "interacao", "interação: a diferença é maior em M?")]:
        print(f"  {label:42} OR {odds[term]:.2f} [IC95% {ci.loc[term, 0]:.2f}–{ci.loc[term, 1]:.2f}]  p = {model.pvalues[term]:.3f}")
        result[key] = {"or": float(odds[term]), "ic": [float(ci.loc[term, 0]), float(ci.loc[term, 1])], "p": float(model.pvalues[term])}
    return result


def compare_medians(audiencias, column, label, unit_scale=100, unit="pp"):
    """Mann-Whitney, bootstrap da diferença de medianas e rank-biserial (M − C)."""
    m = audiencias.loc[audiencias.grupo == "M", column].dropna()
    c = audiencias.loc[audiencias.grupo == "C", column].dropna()
    u = stats.mannwhitneyu(m, c, alternative="two-sided")
    low, high = bootstrap_ci(m, c)
    diff = m.median() - c.median()
    print(f"  {label}: mediana M − C = {unit_scale * diff:+.2f} {unit} [IC95% {unit_scale * low:+.2f} a {unit_scale * high:+.2f}]"
          f"  Mann-Whitney p = {u.pvalue:.3g}  r = {rank_biserial(m, c):+.2f}")
    return {"teste": "Mann-Whitney e bootstrap da diferença de medianas", "diferenca": float(diff),
            "ic": [float(low), float(high)], "p": float(u.pvalue), "r": float(rank_biserial(m, c)),
            "mediana": {"M": float(m.median()), "C": float(c.median())}}


def h2(audiencias):
    print("\nH2 · Conteúdo da justificação (por audiência)")
    return {
        "bem_comum_diferenca": compare_medians(audiencias, "bem_comum_diferenca", "bem comum sensível à diferença"),
        "interesse_de_grupo": compare_medians(audiencias, "interesse_de_grupo", "interesse de grupo"),
    }


def h3(audiencias):
    print("\nH3 · Nível de justificação (média por audiência, escala 0 a 3)")
    return compare_medians(audiencias, "nivel_justificacao", "nível médio", unit_scale=1, unit="")


def h4(audiencias):
    print("\nH4 · Respeito (por audiência)")
    positivo = compare_medians(audiencias, "respeito_positivo", "respeito explícito")
    media = compare_medians(audiencias, "respeito_medio", "nível médio de respeito (0 a 1)", unit_scale=1, unit="")
    table = pd.crosstab(audiencias.grupo, audiencias.algum_negativo).reindex(index=["M", "C"], columns=[1, 0], fill_value=0)
    odds, p = stats.fisher_exact(table.values)
    print(f"  audiências com algum código negativo: M {table.loc['M', 1]}/{table.loc['M'].sum()}, C {table.loc['C', 1]}/{table.loc['C'].sum()}"
          f"  Fisher OR = {odds:.2f}  p = {p:.3f}")
    return {
        "respeito": positivo,
        "media": media,
        "hostilidade": {"teste": "Teste exato de Fisher", "m": [int(table.loc["M", 1]), int(table.loc["M"].sum())],
                        "c": [int(table.loc["C", 1]), int(table.loc["C"].sum())], "or": float(odds), "p": float(p)},
    }


def h5():
    print("\nH5 · Persuasão (análise do David, 10 × 10; permutação exata + correção de Holm)")
    persuasao = json.loads((ROOT / "frontend" / "data" / "persuasao-por-audiencia.json").read_text())
    minorias = set(persuasao["grupos_do_autor"]["minorias"])
    rows = [(int(sid) in minorias, values) for sid, values in persuasao["audiencias"].items()]
    results = []
    for index, categoria in enumerate(persuasao["categorias"]):
        m = [values[index] for is_m, values in rows if is_m]
        c = [values[index] for is_m, values in rows if not is_m]
        diff, p = exact_permutation_diff(m, c)
        results.append((categoria, diff, p))
    adjusted = holm(np.array([p for _, _, p in results]))
    for (categoria, diff, p), p_holm in zip(results, adjusted):
        print(f"  {categoria:24} M − C = {diff:+5.1f} pp  p = {p:.3f}  p (Holm) = {p_holm:.3f}")
    return {"teste": "Permutação exata da diferença de médias (todas as divisões dos grupos), com correção de Holm para as 7 técnicas",
            "categorias": {categoria: {"diferenca": float(diff) / 100, "p": float(p), "p_holm": float(p_holm)}
                           for (categoria, diff, p), p_holm in zip(results, adjusted)}}


def cobertura(audiencias):
    print("\nComplementar · Cobertura (déficit da sociedade civil, por audiência)")
    data = audiencias.dropna(subset=["deficit_civil"]).copy()
    result = compare_medians(data, "deficit_civil", "déficit", unit="pts")
    data["minorias"] = (data.grupo == "M").astype(int)
    data["log_palavras"] = np.log(data.palavras)
    ols = smf.ols("deficit_civil ~ minorias + log_palavras", data=data).fit(cov_type="HC3")
    print(f"  controlando o tamanho (OLS, erros robustos): efeito de M = {100 * ols.params['minorias']:+.1f} pts  p = {ols.pvalues['minorias']:.3f}")
    result["teste"] = "Mann-Whitney e bootstrap; regressão controlando o tamanho da audiência"
    result["ajustado"] = {"efeito": float(ols.params["minorias"]), "p": float(ols.pvalues["minorias"])}
    return result


if __name__ == "__main__":
    turnos, audiencias = load()
    print(f"{audiencias.grupo.value_counts().to_dict()} audiências · {len(turnos)} falas com código de participação")
    results = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "h1": h1(turnos),
        "h2": h2(audiencias),
        "h3": h3(audiencias),
        "h4": h4(audiencias),
        "h5": h5(),
        "cobertura": cobertura(audiencias),
    }
    OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nresultados gravados em {OUTPUT.relative_to(ROOT)}")
