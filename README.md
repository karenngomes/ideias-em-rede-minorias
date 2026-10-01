# Ideias em Rede · Audiências públicas

Aplicação de exploração e análise de audiências públicas da Câmara dos Deputados, com foco em deliberação, participação, cobertura institucional e técnicas de persuasão. O recorte principal compara audiências sobre pautas de grupos minoritários às demais audiências do corpus.

O sistema reúne uma API FastAPI, um banco MongoDB e uma interface Next.js. A interface permite navegar por audiências, acompanhar falas turno a turno, inspecionar posições, justificações, indicadores deliberativos, relações entre falas e resultados agregados por grupo.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Estrutura](#estrutura)
- [Como rodar](#como-rodar)
- [Dados](#dados)
- [Backend](#backend)
- [Frontend](#frontend)
- [Análises](#análises)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Licença](#licença)

## Funcionalidades

| Página | Rota | Conteúdo |
|---|---|---|
| Página inicial | `/` | síntese do estudo, números gerais e acesso ao recorte |
| Acervo | `/audiencias` | lista paginada das 206 audiências, com filtros por grupo e categoria |
| Turno a turno | `/audiencias/[id]/turnos` | transcrição, opiniões, resumo, DQI, cobertura, persuasão e relações entre falas |
| Comparação | `/comparacao` | comparação exploratória entre grupo M e grupo C |
| Prévias | `/previa/a` a `/previa/d` | alternativas de apresentação da página inicial |

### Turno a turno

A página de cada audiência combina quatro camadas do pacote de conteúdo:

- transcrição segmentada por `turno_id`;
- posições/opiniões associadas às falas;
- resumo temático e grafo de relações do pacote;
- indicadores deliberativos, cobertura e evidências de persuasão.

O gráfico principal possui dois modos. O mapa de posições mostra cada opinião no turno em que foi dita, com cor por tema do resumo. A rede de interação mostra a sequência de falas, concessões de palavra e marcações de interrupção. A regra de interrupção ainda está em revisão, por isso esses sinais devem ser tratados como exploratórios.

O painel de leitura alterna entre transcrição, resumo, matéria gerada e deliberação. O detalhe da opinião mostra a fala de origem, qualificadores e fundamentos extraídos do pacote de conteúdo.

### Relações entre falas

A aba de relações usa uma rotina baseada em modelo de linguagem para classificar como uma fala se relaciona com falas anteriores. As relações incluem resposta, pergunta, concordância, discordância, retomada, correção, concessão de palavra e outros tipos. O diagrama apresenta uma coluna por participante e uma seta por relação.

Há três abordagens disponíveis:

| Abordagem | Descrição |
|---|---|
| `rag_pairwise` | pares consecutivos e pares distantes recuperados por embeddings |
| `protocol` | cada fala comparada com todas as anteriores |
| `protocol_rag` | protocolo aplicado sobre falas recuperadas por embeddings |

O frontend mostra resultados já salvos no MongoDB. Quando uma abordagem ainda não foi gerada para a audiência, a interface oferece a opção de executar a análise, o que consome a API configurada no backend.

### Persuasão

Nas audiências classificadas, o modo persuasão destaca na transcrição as técnicas encontradas pelo modelo e mostra a explicação de cada marcação. As classes usadas são:

- ataque à reputação;
- justificativa;
- simplificação;
- distração;
- chamada à ação;
- linguagem manipulativa;
- nenhuma técnica.

A classificação é multilabel: uma fala ou trecho pode receber mais de uma técnica. O painel também compara parlamentares e convidados, usando apenas falas com pelo menos 50 palavras. Falas de quem preside são excluídas por padrão, pois em geral cumprem função de condução da sessão.

### Comparação entre grupos

A página `/comparacao` apresenta uma análise exploratória das 53 audiências do grupo M e das 153 audiências do grupo C. As seções seguem as hipóteses do estudo:

| Seção | Indicador | Origem |
|---|---|---|
| H1 · Interrupções | interrupções por papel do falante | regra heurística, em revisão |
| H2 · Conteúdo da justificação | bem comum sensível à diferença e interesse de grupo | DQI via LLM |
| H3 · Nível de justificação | nível médio de justificação | DQI via LLM |
| H4 · Respeito | respeito explícito, hostilidade e média de respeito | DQI via LLM |
| H5 · Persuasão | distribuição de técnicas persuasivas | classificação via LLM |
| Cobertura | déficit da sociedade civil na matéria institucional | pacote de conteúdo |
| Contexto | palavras por audiência | pacote de conteúdo |

Os resultados estatísticos são carregados de `frontend/data/testes-estatisticos.json`, gerado por `analises/testes_estatisticos.py`. As medianas e gráficos são calculados no servidor a partir do pacote de conteúdo.

## Estrutura

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                    # endpoints FastAPI
│   │   ├── database.py                # conexão MongoDB
│   │   ├── persuasion_approaches.py   # classificação de persuasão
│   │   └── conversation_relations.py  # relações entre falas
│   ├── tests/                         # testes do backend
│   ├── baixar_dados.py                # download do corpus PublicHearingBR
│   ├── importar_mongodb.py            # importação para MongoDB
│   ├── chunk_transcricoes.py          # segmentação em falas
│   ├── exportar_anotacoes.py          # exportações para validação
│   ├── exportar_amostra_estratificada.py
│   └── google_apps_script/            # protótipo de validação humana
├── frontend/
│   ├── app/                           # rotas Next.js
│   ├── components/                    # componentes de visualização
│   ├── data/                          # resultados agregados usados no frontend
│   ├── lib/
│   │   ├── api-server.ts              # chamadas à API no servidor
│   │   ├── audiencias.ts              # tipos e derivados do pacote de conteúdo
│   │   ├── conteudo-data.ts           # leitura dos JSONs de conteúdo
│   │   ├── comparacao.ts              # indicadores da comparação M × C
│   │   └── persuasion-api.ts          # tipos da API de persuasão
│   └── public/                        # imagens e logos
├── analises/
│   ├── testes_estatisticos.py         # testes do painel comparativo
│   └── transcript_simplification.ipynb
├── dados/conteudo/                    # pacote de conteúdo em JSON
├── backups/                           # dumps locais do MongoDB, quando gerados
├── LICENSE
└── README.md
```

## Como rodar

Pré-requisitos:

- Docker;
- Python 3.10+;
- Node 20+.

### 1. MongoDB

Suba um MongoDB local:

```bash
docker run -d --name ideias_em_rede_mongo --restart unless-stopped -p 27018:27017 -v ideias_em_rede_mongo_data:/data/db -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=change-this-password mongo:latest
```

Para restaurar um dump:

```bash
docker cp public_hearing_br.dump.gz ideias_em_rede_mongo:/tmp/
```

```bash
docker exec ideias_em_rede_mongo mongorestore --uri="mongodb://admin:change-this-password@localhost:27017/?authSource=admin" --archive=/tmp/public_hearing_br.dump.gz --gzip
```

Sem dump, o banco pode ser reconstruído a partir do corpus público com `baixar_dados.py`, `importar_mongodb.py` e `chunk_transcricoes.py`. Classificações de persuasão e relações entre falas precisam ser executadas novamente nesse caso.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edite `backend/.env` e configure `MONGODB_URL`, `MONGODB_DATABASE` e, quando for executar novas chamadas a modelo, `OPENAI_API_KEY`.

```bash
.venv/bin/uvicorn app.main:app --reload --port 8000
```

A documentação interativa fica em <http://localhost:8000/docs>.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abra <http://localhost:3000>.

Por padrão, o frontend chama a API em `http://127.0.0.1:8000`. Para alterar:

```text
API_URL=http://127.0.0.1:8030
```

Crie essa variável em `frontend/.env.local`.

### Testes

```bash
cd backend && .venv/bin/python -m unittest discover -s tests -t .
```

```bash
cd frontend && npx tsc --noEmit
```

## Dados

### MongoDB

O banco padrão é `public_hearing_br`. Ele contém:

| Coleção | Conteúdo |
|---|---|
| `lds` | registros das audiências |
| `nli` | dados de avaliação NLI |
| `transcript_chunks` | falas segmentadas |
| `classification_jobs` | execuções de classificação |
| `persuasion_classification_results` | resultados de persuasão |
| `conversation_relation_runs` | execuções de relações entre falas |

### Pacote de conteúdo

Os arquivos em `dados/conteudo/dados` são lidos diretamente pelo frontend no servidor. A documentação do formato fica em `dados/conteudo/README.md` e `dados/conteudo/CONTRATO.md`.

| Arquivo | Conteúdo |
|---|---|
| `indice_audiencias.json` | uma linha por audiência, com grupo, tema e assunto |
| `rotulos/rotulos_minorias.json` | categorias não exclusivas do grupo M |
| `rotulos/temas.json` | temas exclusivos do corpus |
| `audiencias/audiencia_NNN/turnos.json` | transcrição segmentada por fala |
| `audiencias/audiencia_NNN/opinioes.json` | posições dos participantes |
| `audiencias/audiencia_NNN/grafo.json` | grafo de opiniões e participantes |
| `audiencias/audiencia_NNN/resumo.json` | resumo temático ligado às opiniões |
| `audiencias/audiencia_NNN/materia.json` | matéria gerada pelo pipeline, com âncoras |
| `audiencias/audiencia_NNN/argumento_intra.json` | fundamentos de cada posição |
| `audiencias/audiencia_NNN/clausulas.json` | ressalvas associadas às posições |
| `audiencias/audiencia_NNN/dqi.json` | indicadores deliberativos por fala |
| `audiencias/audiencia_NNN/cobertura.json` | participantes, citações e déficit de cobertura |
| `audiencias/audiencia_NNN/proveniencia.json` | conferência de ancoragem das posições |

A variável `CONTENT_DATA_DIR` permite apontar o frontend para outro diretório de dados.

### Recorte M/C

O grupo M reúne 53 audiências sobre pautas de grupos minoritários. O grupo C reúne as demais 153 audiências. As categorias do grupo M não são exclusivas: uma mesma audiência pode aparecer em mais de uma categoria.

A análise agregada de persuasão usa uma subamostra balanceada de 20 audiências, com 10 audiências no grupo M e 10 no grupo C conforme a amostra de persuasão registrada em `frontend/data/persuasao-por-audiencia.json`.

## Backend

### Endpoints principais

| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | status e contagens do banco |
| GET | `/lds` | lista paginada de audiências |
| GET | `/lds/{id}` | dados de uma audiência |
| GET | `/lds/{id}/chunks` | falas segmentadas |
| GET | `/lds/{id}/persuasion-classifications` | execuções de persuasão de uma audiência |
| POST | `/persuasion-classifications` | inicia classificação de persuasão |
| GET | `/persuasion-classifications/{job_id}` | status da execução |
| GET | `/persuasion-classifications/{job_id}/results` | resultados da execução |
| GET | `/persuasion-classifications/{job_id}/summary` | resumo por tipo de falante |
| GET | `/persuasion-classified-records` | audiências com classificação |
| GET | `/lds/{id}/conversation-relations` | relações entre falas já geradas |
| POST | `/lds/{id}/conversation-relations` | gera relações entre falas |
| POST | `/conversation-relations/infer` | infere relações para falas enviadas no corpo |
| GET | `/nli`, `/nli/{id}`, `/records/{id}` | dados auxiliares de avaliação |

### Classificação de persuasão

A abordagem `persuationclassifcona_7_class_few_shot` segmenta falas longas, envia trechos ao modelo e grava resultados e auditoria no MongoDB. Evidências que não aparecem literalmente no texto são marcadas com `evidence_reliable=false`.

Exemplo:

```bash
curl -X POST "http://localhost:8000/persuasion-classifications" \
  -H "Content-Type: application/json" \
  -d '{"id": 163, "approach": "persuationclassifcona_7_class_few_shot", "experiments_tag": "minorias-001"}'
```

## Frontend

O frontend usa Next.js 15, React 19, Tailwind CSS e `lucide-react`. Os gráficos principais são SVGs implementados no próprio projeto.

As páginas leem duas fontes:

- API FastAPI, via `frontend/lib/api-server.ts`;
- pacote de conteúdo, via `frontend/lib/conteudo-data.ts`.

Os tipos e funções derivadas do pacote ficam em `frontend/lib/audiencias.ts`. Os indicadores do painel comparativo ficam em `frontend/lib/comparacao.ts`.

## Análises

### Testes estatísticos

O script `analises/testes_estatisticos.py` calcula os testes exibidos em `/comparacao` e grava `frontend/data/testes-estatisticos.json`.

```bash
python3 analises/testes_estatisticos.py
```

Resumo dos métodos:

| Hipótese | Unidade | Teste |
|---|---|---|
| H1 · Interrupções | fala | regressão logística com GEE, agrupada por audiência |
| H2 · Conteúdo da justificação | audiência | Mann-Whitney, rank-biserial e bootstrap da diferença de medianas |
| H3 · Nível de justificação | audiência | Mann-Whitney e bootstrap |
| H4 · Respeito | audiência | Mann-Whitney e teste exato de Fisher para hostilidade |
| H5 · Persuasão | audiência | permutação exata da diferença de médias, com correção de Holm |
| Cobertura | audiência | Mann-Whitney, bootstrap e OLS com erros robustos |

Resultados atuais, ainda exploratórios:

| Hipótese | Resultado |
|---|---|
| H1 | sem diferença significativa na interação entre papel do falante e grupo |
| H2 | maior presença de bem comum sensível à diferença no grupo M; interesse de grupo sem diferença |
| H3 | sem diferença significativa no nível médio de justificação |
| H4 | mais respeito explícito no grupo M; sem maior hostilidade |
| H5 | menor proporção de trechos sem técnica no grupo M após correção de Holm; técnicas específicas sem evidência robusta após correção |
| Cobertura | sem diferença significativa entre M e C |

### Notebook de simplificação

`analises/transcript_simplification.ipynb` contém experimentos de simplificação de transcrições. O notebook foi mantido na pasta de análises por ser material de apoio ao pipeline, não parte do frontend.

## Variáveis de ambiente

| Variável | Local | Uso |
|---|---|---|
| `MONGODB_URL` | backend | conexão com MongoDB |
| `MONGODB_DATABASE` | backend | nome do banco |
| `OPENAI_API_KEY` | backend | chamadas a modelos |
| `OPENAI_CLASSIFICATION_MODEL` | backend | modelo de classificação de persuasão |
| `OPENAI_EMBEDDING_MODEL` | backend | embeddings para relações entre falas |
| `OPENAI_RELATION_MODEL` | backend | modelo de relações entre falas |
| `RELATION_RAG_CANDIDATE_COUNT` | backend | quantidade de candidatos por RAG |
| `RELATION_MIN_CONFIDENCE` | backend | confiança mínima para relações |
| `API_URL` | frontend | URL da API FastAPI |
| `CONTENT_DATA_DIR` | frontend | diretório alternativo do pacote de conteúdo |

## Licença

MIT. Veja `LICENSE`.
