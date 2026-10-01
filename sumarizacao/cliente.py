"""Chamada à API Responses da OpenAI com saída estruturada (JSON Schema) e cache."""

import hashlib
import json
import os
import threading
import time
from pathlib import Path

from comum.llm import carregar_env

from . import config

INSTRUCOES = (Path(__file__).resolve().parent / "prompts" / "instrucoes.md").read_text(
    encoding="utf-8"
).strip()


class ClienteResponses:
    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = None
        self._trava = threading.Lock()

    def _cliente(self):
        with self._trava:
            if self._client is None:
                from openai import OpenAI

                carregar_env()
                chave = os.environ.get("OPENAI_API_KEY", "").strip()
                if not chave:
                    raise RuntimeError("defina OPENAI_API_KEY no ambiente ou no .env")
                self._client = OpenAI(api_key=chave, timeout=config.TIMEOUT_S, max_retries=0)
        return self._client

    def gerar_json(
        self,
        *,
        prompt: str,
        modelo: str,
        schema_nome: str,
        schema: dict,
        esforco: str,
        max_saida: int,
    ) -> dict:
        identidade = {
            "versao": 1,
            "modelo": modelo,
            "prompt": prompt,
            "schema_nome": schema_nome,
            "schema": schema,
            "reasoning_effort": esforco,
            "max_output_tokens": max_saida,
        }
        chave = hashlib.sha256(
            json.dumps(identidade, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        caminho = self.cache_dir / f"{chave}.json"
        if caminho.exists():
            return json.loads(caminho.read_text(encoding="utf-8"))["data"]

        ultimo_erro = None
        for tentativa in range(1, config.TENTATIVAS + 1):
            if tentativa > 1:
                time.sleep(min(2 ** (tentativa - 1), 8))
            try:
                resposta = self._cliente().responses.create(
                    model=modelo,
                    instructions=INSTRUCOES,
                    input=prompt,
                    reasoning={"effort": esforco},
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": schema_nome,
                            "strict": True,
                            "schema": schema,
                        }
                    },
                    max_output_tokens=max_saida,
                    store=False,
                )
                if getattr(resposta, "status", "completed") != "completed":
                    raise RuntimeError(f"resposta incompleta: {resposta.incomplete_details}")
                data = json.loads((resposta.output_text or "").strip())
            except Exception as exc:
                ultimo_erro = exc
                continue
            caminho.write_text(
                json.dumps({"data": data, "meta": {"modelo": modelo}}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return data
        raise RuntimeError(f"falha após {config.TENTATIVAS} tentativas: {ultimo_erro}")
