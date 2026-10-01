#!/usr/bin/env python3
"""Importa artefatos já gerados no desafio_kunumi sem executar pipelines.

Mantém os arquivos antigos do pacote e publica as novas camadas com nomes próprios,
para que consumidores possam migrar sem quebrar o contrato anterior.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


AQUI = Path(__file__).resolve().parent
DADOS = AQUI / "dados"
AUDIENCIAS = DADOS / "audiencias"
ORIGEM_PADRAO = AQUI.parents[2] / "desafio_kunumi"

ARQUIVOS_SUMARIO = {
    "resumo.json": "resumo_ancorado.json",
    "unidades.json": "unidades_resumo.json",
    "unidades_rejeitadas.json": "unidades_rejeitadas_resumo.json",
    "blocos.json": "blocos_simplificados.json",
    "manifest.json": "sumarizacao_manifest.json",
}


def ler_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def gravar_json(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def git_rev(repo: Path) -> str:
    return subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def git_dirty(repo: Path) -> bool:
    return bool(
        subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repo,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    )


def conferir_sumario(pasta: Path, sample_id: int) -> tuple[dict, list[dict]]:
    resumo = ler_json(pasta / "resumo.json")
    unidades = ler_json(pasta / "unidades.json")
    if resumo.get("sample_id") != sample_id:
        raise ValueError(f"resumo {sample_id:03d} declara id {resumo.get('sample_id')}")
    ids = {u["id"] for u in unidades}
    referencias = {
        uid
        for secao in resumo.get("secoes", [])
        for frase in secao.get("frases", [])
        for uid in frase.get("deriva_de", [])
    }
    ausentes = sorted(referencias - ids)
    if ausentes:
        raise ValueError(
            f"resumo {sample_id:03d} referencia unidades ausentes: {ausentes[:5]}"
        )
    return resumo, unidades


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origem", type=Path, default=ORIGEM_PADRAO)
    args = parser.parse_args()

    origem = args.origem.resolve()
    sumarios = origem / "saida" / "sumarizacao_ancorada"
    interrupcoes = origem / "saida" / "interrupcao"
    if not (sumarios.is_dir() and interrupcoes.is_dir() and AUDIENCIAS.is_dir()):
        raise SystemExit("origem ou destino não possui a estrutura esperada")

    indice_path = DADOS / "indice_audiencias.json"
    indice = ler_json(indice_path)
    por_id = {int(item["sample_id"]): item for item in indice}

    ids_sumario: list[int] = []
    ids_interrupcao: list[int] = []
    modelos: dict[str, set[str]] = {
        "extracao": set(),
        "sintese": set(),
        "embeddings": set(),
    }

    for sample_id in range(1, 207):
        destino = AUDIENCIAS / f"audiencia_{sample_id:03d}"
        item = por_id[sample_id]

        pasta_sumario = sumarios / f"{sample_id:03d}"
        completo = all((pasta_sumario / nome).exists() for nome in ARQUIVOS_SUMARIO)
        item["camadas"]["resumo_ancorado.json"] = completo
        item["camadas"]["unidades_resumo.json"] = completo
        if completo:
            conferir_sumario(pasta_sumario, sample_id)
            for fonte, nome_destino in ARQUIVOS_SUMARIO.items():
                shutil.copyfile(pasta_sumario / fonte, destino / nome_destino)
            manifest = ler_json(pasta_sumario / "manifest.json")
            for etapa, modelo in (manifest.get("modelos") or {}).items():
                if etapa in modelos and modelo:
                    modelos[etapa].add(str(modelo))
            ids_sumario.append(sample_id)

        fonte_interrupcao = interrupcoes / f"{sample_id:03d}.json"
        tem_interrupcao = fonte_interrupcao.exists()
        item["camadas"]["interrupcoes.json"] = tem_interrupcao
        if tem_interrupcao:
            dados_interrupcao = ler_json(fonte_interrupcao)
            if dados_interrupcao.get("sample_id") != sample_id:
                raise ValueError(f"interrupção {sample_id:03d} declara outro sample_id")
            shutil.copyfile(fonte_interrupcao, destino / "interrupcoes.json")
            ids_interrupcao.append(sample_id)

    shutil.copyfile(
        interrupcoes / "resultados.json", DADOS / "interrupcoes_resultados.json"
    )
    shutil.copyfile(interrupcoes / "eventos.csv", DADOS / "interrupcoes_eventos.csv")

    gravar_json(indice_path, indice)
    manifest_path = DADOS / "manifest.json"
    manifest = ler_json(manifest_path)
    cobertura = manifest.setdefault("cobertura_por_camada", {})
    cobertura["resumo_ancorado.json"] = len(ids_sumario)
    cobertura["unidades_resumo.json"] = len(ids_sumario)
    cobertura["interrupcoes.json"] = len(ids_interrupcao)
    manifest["atualizacao_resultados"] = {
        "importado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "origem": "desafio_kunumi",
        "origem_git_rev": git_rev(origem),
        "origem_worktree_com_alteracoes": git_dirty(origem),
        "sumarizacao_ancorada": {
            "n_audiencias": len(ids_sumario),
            "ids": ids_sumario,
            "faltantes": [i for i in range(1, 207) if i not in ids_sumario],
            "modelos": {k: sorted(v) for k, v in modelos.items()},
            "observacao": "Somente artefatos concluídos existentes foram importados; nenhuma pipeline foi executada.",
        },
        "interrupcoes": {
            "n_audiencias": len(ids_interrupcao),
            "ids": ids_interrupcao,
            "metodo": "deterministico_exploratorio_v2",
        },
    }
    gravar_json(manifest_path, manifest)

    print(f"sumarizações ancoradas importadas: {len(ids_sumario)}")
    print(f"análises de interrupção importadas: {len(ids_interrupcao)}")
    print(f"sumarizações ausentes: {206 - len(ids_sumario)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
