"""Cliente de chat compatível com a API da OpenAI, com cache em disco.

A chave do cache é o hash de (modelo, mensagens, parâmetros). Repetir uma execução
lê as respostas do cache e não faz chamadas.
"""

import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

from .corpus import RAIZ

RACIOCINIO_RE = re.compile(r"<(think|thinking|reasoning)>.*?</\1>", re.S | re.I)
CACHE_PADRAO = RAIZ / ".cache" / "llm"


def carregar_env() -> None:
    """Lê o `.env` da raiz do repositório, sem sobrescrever o ambiente."""
    caminho = RAIZ / ".env"
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip().strip("\"'"))


def carregar_prompt(arquivo: Path, **campos) -> str:
    """Lê o prompt e troca cada `<<CAMPO>>` pelo valor correspondente."""
    texto = Path(arquivo).read_text(encoding="utf-8")
    for chave, valor in campos.items():
        texto = texto.replace(f"<<{chave.upper()}>>", str(valor))
    faltando = re.findall(r"<<([A-Z_]+)>>", texto)
    if faltando:
        raise ValueError(f"campos sem valor em {arquivo}: {sorted(set(faltando))}")
    return texto


@dataclass
class Resposta:
    texto: str
    finish_reason: str = ""

    @property
    def truncada(self) -> bool:
        return self.finish_reason == "length"


class LLM:
    def __init__(
        self,
        *,
        modelo: str,
        params: dict,
        base_url: str,
        chave_env: str,
        timeout_s: float,
        cache_dir: Path = CACHE_PADRAO,
        tentativas: int = 5,
    ) -> None:
        self.modelo = modelo
        self.params = params
        self.base_url = base_url
        self.chave_env = chave_env
        self.timeout_s = timeout_s
        self.tentativas = tentativas
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = None

    def _cliente(self):
        if self._client is None:
            from openai import OpenAI

            carregar_env()
            chave = os.environ.get(self.chave_env)
            if not chave:
                raise RuntimeError(f"defina {self.chave_env} no ambiente ou no .env")
            self._client = OpenAI(
                base_url=self.base_url, api_key=chave, timeout=self.timeout_s, max_retries=0
            )
        return self._client

    def complete(self, prompt: str) -> Resposta:
        mensagens = [{"role": "user", "content": prompt}]
        identidade = {
            "modelo": self.modelo,
            "mensagens": mensagens,
            "params": {**self.params, "extra_body": None},
        }
        chave = hashlib.sha256(
            json.dumps(identidade, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        caminho = self.cache_dir / f"{chave}.json"
        if caminho.exists():
            salvo = json.loads(caminho.read_text(encoding="utf-8"))
            if (salvo.get("texto") or "").strip():
                return Resposta(salvo["texto"], salvo.get("finish_reason", ""))

        ultimo_erro = None
        for tentativa in range(1, self.tentativas + 1):
            if tentativa > 1:
                time.sleep(min(2 ** (tentativa - 1), 30))
            inicio = time.time()
            try:
                r = self._cliente().chat.completions.create(
                    model=self.modelo, messages=mensagens, **self.params
                )
            except Exception as exc:
                ultimo_erro = exc
                continue
            escolha = r.choices[0]
            texto = RACIOCINIO_RE.sub("", escolha.message.content or "").strip()
            if not texto:
                ultimo_erro = RuntimeError("resposta vazia do provedor")
                continue
            caminho.write_text(
                json.dumps(
                    {
                        "texto": texto,
                        "modelo": self.modelo,
                        "tokens_in": getattr(r.usage, "prompt_tokens", 0) or 0,
                        "tokens_out": getattr(r.usage, "completion_tokens", 0) or 0,
                        "latencia_ms": int((time.time() - inicio) * 1000),
                        "finish_reason": escolha.finish_reason or "",
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            return Resposta(texto, escolha.finish_reason or "")
        raise RuntimeError(f"falha após {self.tentativas} tentativas: {ultimo_erro}")


def ler_json(bruto: str) -> dict:
    """Lê o objeto JSON da resposta, com dois reparos só de pontuação.

    Os reparos: `)` no lugar de `}` e zero à esquerda em `turno_id`.
    """
    if not bruto or "{" not in bruto or "}" not in bruto:
        raise ValueError(f"resposta sem objeto JSON: {(bruto or '')[:200]!r}")
    corpo = bruto[bruto.find("{") : bruto.rfind("}") + 1]
    try:
        return json.loads(corpo)
    except json.JSONDecodeError:
        corpo, n1 = re.subn(r'(["\d])\s*\)(\s*[,\]])', r"\1}\2", corpo)
        corpo, n2 = re.subn(r'("turno_id"\s*:\s*)0+(\d)', r"\1\2", corpo)
        if not (n1 or n2):
            raise
        return json.loads(corpo)
