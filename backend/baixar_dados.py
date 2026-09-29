from pathlib import Path
import shutil
import sys

from huggingface_hub import hf_hub_download, list_repo_files


REPO_ID = "unicamp-dl/PublicHearingBR"
OUTPUT_DIR = Path("dados")


def contar_registros(arquivo: Path) -> int:
    """Conta as linhas não vazias de um arquivo JSONL."""
    with arquivo.open("r", encoding="utf-8") as stream:
        return sum(1 for linha in stream if linha.strip())


def main() -> int:
    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"🔄 Baixando arquivos de {REPO_ID} do Hugging Face...\n")

    try:
        arquivos = list_repo_files(REPO_ID, repo_type="dataset")
        arquivos_jsonl = sorted(
            arquivo for arquivo in arquivos if arquivo.lower().endswith(".jsonl")
        )
    except Exception as erro:
        print(f"❌ Não foi possível consultar o dataset: {erro}", file=sys.stderr)
        return 1

    if not arquivos_jsonl:
        print("❌ Nenhum arquivo JSONL foi encontrado no dataset.", file=sys.stderr)
        return 1

    baixados = []
    for nome in arquivos_jsonl:
        destino = OUTPUT_DIR / Path(nome).name
        try:
            print(f"📥 Baixando {nome}...")
            cache = hf_hub_download(
                repo_id=REPO_ID,
                filename=nome,
                repo_type="dataset",
            )
            shutil.copyfile(cache, destino)
            registros = contar_registros(destino)
            tamanho_mb = destino.stat().st_size / (1024 * 1024)
            print(
                f"✅ {registros} registros salvos em {destino} "
                f"({tamanho_mb:.2f} MB)\n"
            )
            baixados.append(destino)
        except Exception as erro:
            print(f"❌ Falha ao baixar {nome}: {erro}\n", file=sys.stderr)

    if not baixados:
        print("❌ Nenhum arquivo foi baixado.", file=sys.stderr)
        return 1

    print(f"✨ Download concluído: {len(baixados)} arquivo(s) em ./{OUTPUT_DIR}/")
    if len(baixados) != len(arquivos_jsonl):
        print("⚠️  Alguns arquivos não puderam ser baixados.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
