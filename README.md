# Karkará · Ideias em Rede — recorte de minorias

Projeto da equipe **Karkará** no desafio Ideias em Rede, do Instituto Kunumi.

Ferramenta de visualização para o artigo *O Comportamento das Audiências
Públicas e suas Características Argumentativas: um Recorte sobre Grupos
Minoritários*. Junta o que foi mantido de dois projetos anteriores:

- `backend/` vem do `ideias-em-rede-am`. É a API FastAPI sobre o MongoDB
  `public_hearing_br`, com a classificação de persuasão em 7 classes, os
  scripts de exportação para anotação humana e o Apps Script de validação.
- `frontend/` vem do `ideias-em-rede`. É o app Next.js com as abas de
  interação, argumentação e resumo. A aba **Tipo de argumentação** lê os dados
  reais da API. As outras abas ainda usam dados demonstrativos, e os dados da
  Thalia estão simulados em `frontend/data/mocks/901`.

## Como rodar

Pré-requisitos: MongoDB com o banco `public_hearing_br` restaurado (veja
`backend/.env.example`), Python 3.10+ e Node 20.

**Backend**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # ajuste MONGODB_URL e OPENAI_API_KEY
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Documentação da API: <http://localhost:8000/docs>. Para rodar os testes:

```bash
.venv/bin/python -m unittest discover -s tests -t .
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Abra <http://localhost:3000>. O navegador acessa a API por um proxy em
`/api/backend`, configurado em `next.config.ts`. Se o backend não estiver em
`http://127.0.0.1:8000`, defina `API_URL` em `frontend/.env.local`.

## Persuasão (7 classes, multilabel)

A abordagem `persuationclassifcona_7_class_few_shot` classifica cada parágrafo
das falas em `ataque_a_reputacao`, `justificativa`, `simplificacao`,
`distracao`, `chamada`, `linguagem_manipulativa` ou `nenhuma`. Cada chamada ao
modelo fica registrada em `audit.executions` e pode ser vista pelo botão
**Ver auditoria**.

```bash
curl -X POST "http://localhost:8000/persuasion-classifications" \
  -H "Content-Type: application/json" \
  -d '{"id": 163, "approach": "persuationclassifcona_7_class_few_shot", "experiments_tag": "minorias-001"}'
```

Endpoints usados pela aba de argumentação:

- `GET /persuasion-classified-records`: audiências que já têm classificação.
- `GET /persuasion-classifications/{job_id}/summary`: falas com cada técnica,
  no total e separadas entre parlamentares e convidados. Conta como parlamentar
  quem tem partido informado em alguma fala da audiência.
- `GET /lds/{id}/chunks?classification_job_id=...`: falas com as anotações.

A tela identifica o grupo minoritário pela tag do experimento (`racial-black`,
`indigenous`, `lgbt`, `pcd`, `women`).

## Anotação humana

`backend/exportar_anotacoes.py` e `backend/exportar_amostra_estratificada.py`
geram as planilhas de validação. As amostras já exportadas ficam em
`backend/outputs/`. O formulário de validação está em
`backend/google_apps_script/validacao_persuasao/`.

## Identidade visual e licença

O visual segue o guia rápido da marca do Instituto Kunumi: fonte Figtree,
grafite `#1c2127`, cinza `#f0f0f0` e coral `#ff4b3e`, com o degradê da marca no
cabeçalho das audiências. Os tokens estão em `frontend/tailwind.config.ts` e os
logos em `frontend/public/`.

O código é distribuído sob a licença MIT (veja `LICENSE`).
