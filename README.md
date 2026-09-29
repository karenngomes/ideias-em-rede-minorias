# Karkará · Ideias em Rede

Ferramenta de visualização da equipe **Karkará** para o desafio **Ideias em Rede**,
do Instituto Kunumi. Ela acompanha o artigo *O Comportamento das Audiências
Públicas e suas Características Argumentativas: um Recorte sobre Grupos
Minoritários*.

> Como deliberam as audiências públicas sobre minorias, e como essa deliberação
> chega ao público?

O projeto junta dois trabalhos anteriores:

- `backend/`: API FastAPI sobre o MongoDB `public_hearing_br` (206 audiências da
  Câmara dos Deputados), com a classificação de técnicas de persuasão e os
  scripts de anotação humana. Veio do projeto `ideias-em-rede-am`.
- `frontend/`: aplicação Next.js com a home do artigo, o acervo de audiências e
  as páginas de análise de cada audiência. Veio do projeto `ideias-em-rede`.

## Sumário

- [O que a ferramenta mostra](#o-que-a-ferramenta-mostra)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como rodar](#como-rodar)
- [Dados](#dados)
- [Backend](#backend)
- [Frontend](#frontend)
- [Identidade visual](#identidade-visual)
- [O que está faltando](#o-que-está-faltando)
- [Licença](#licença)

## O que a ferramenta mostra

| Página | Endereço | Dados |
|---|---|---|
| Home do artigo | `/` | reais (contagens e recorte) |
| Acervo de audiências | `/audiencias` | reais |
| Turno a turno | `/audiencias/[id]/turnos` | reais (pacote da Thalia) |
| Tipo de argumentação | `/audiencias/[id]/argumentacao` | reais (persuasão) |
| Interações entre falantes | `/audiencias/[id]/interacoes` | **demonstrativos** |
| Resumo em níveis | `/audiencias/[id]/resumo` | **demonstrativos** |
| Prévias da home | `/previa/a` … `/previa/d` | reais; em avaliação |

Toda página de audiência tem o mesmo cabeçalho (assunto, data, grupo minoritário
quando houver, participantes) e um menu entre as análises. Páginas com dados
simulados ou demonstrativos exibem um aviso.

### Turno a turno

Inspirada na implementação de referência da Thalia e ligada ao pacote de dados
dela (206 audiências). Tudo se resolve pelo `turno_id`, e a linha do tempo filtra
todas as partes ao mesmo tempo:

- **Gráfico**, em dois modos:
  - *mapa de posições*: cada opinião no turno em que foi dita, colorida pelo
    tema, com ligações entre opiniões do mesmo tema;
  - *rede de interação*: sequência de falas, passagens de palavra e
    interrupções.
- **Painel de leitura**:
  - *Transcrição*: acompanha o turno atual.
  - *Resumo*: cada seção acende quando ganha evidência.
  - *Matéria*: a notícia da Agência Câmara com cada citação ligada ao turno de
    origem, e quem falou × quem foi citado, com o déficit da sociedade civil.
  - *Deliberação*: as 7 dimensões do DQI, com os trechos citados.
- **Detalhe da opinião**: mostra a fala que a sustenta (âncora), os
  fundamentos (dados, autoridades) e as ressalvas destacados no texto.
- **Linha do tempo**: play, velocidades de 0,5× a 4× e histograma do tamanho
  dos turnos.

### Tipo de argumentação

Cada parágrafo das falas é classificado por um modelo de linguagem em seis
técnicas de persuasão, que podem coexistir: ataque à reputação, justificativa,
simplificação, distração, chamada para ação e linguagem manipulativa. Também
pode receber "nenhuma". A página mostra:

- o resumo por tipo de falante (parlamentares × convidados);
- a transcrição com os trechos de evidência destacados;
- a auditoria de cada chamada ao modelo (prompt e resposta).

O recorte de minorias segue a rotulagem da Thalia: **53 audiências no grupo M**,
em 8 categorias não exclusivas, e 153 no grupo C. A persuasão foi classificada
em **10 audiências do grupo M**:

| Grupo | Audiências |
|---|---|
| Pessoas negras | 163, 180 |
| Povos indígenas | 20, 136 |
| LGBTQIA+ | 48, 85 |
| Pessoas com deficiência | 37, 176 |
| Mulheres | 26, 121 |

A audiência 140 foi usada como piloto e aparece como "fora do recorte".

## Estrutura do repositório

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                    # endpoints FastAPI
│   │   ├── persuasion_approaches.py   # classificador de persuasão (7 classes)
│   │   └── database.py                # conexão MongoDB
│   ├── tests/                         # testes (unittest)
│   ├── importar_mongodb.py            # importa os JSONL do corpus
│   ├── baixar_dados.py                # baixa o corpus PublicHearingBR
│   ├── chunk_transcricoes.py          # divide as transcrições em falas
│   ├── exportar_anotacoes.py          # exporta anotações para Excel
│   ├── exportar_amostra_estratificada.py
│   ├── google_apps_script/            # formulário de validação humana
│   ├── outputs/                       # amostras de anotação já exportadas
│   └── requirements.txt
├── frontend/
│   ├── app/                           # rotas Next.js (App Router)
│   ├── components/
│   │   ├── argumentation/             # página de persuasão
│   │   ├── turnos/                    # página Turno a turno
│   │   ├── home/                      # partes compartilhadas das prévias
│   │   └── network-graph.tsx          # páginas demonstrativas antigas
│   ├── lib/
│   │   ├── api-server.ts              # chamadas à API no servidor
│   │   ├── persuasion-api.ts          # chamadas à API no navegador
│   │   ├── thalia.ts                  # tipos e dados derivados do pacote da Thalia
│   │   └── thalia-data.ts             # leitura do pacote no servidor
│   └── public/                        # logos do Instituto Kunumi
├── dados/conteudo/                    # pacote de dados da Thalia (JSON)
├── LICENSE
└── README.md
```

## Como rodar

Pré-requisitos: Docker, Python 3.10+ e Node 20.

### 1. MongoDB

Suba um MongoDB com usuário `admin`:

```bash
docker run -d --name ideias_em_rede_mongo --restart unless-stopped -p 27018:27017 -v ideias_em_rede_mongo_data:/data/db -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=change-this-password mongo:latest
```

Restaure o banco a partir do backup `public_hearing_br.dump.gz`, que é
compartilhado à parte e não fica no repositório:

```bash
docker cp public_hearing_br.dump.gz ideias_em_rede_mongo:/tmp/
```

```bash
docker exec ideias_em_rede_mongo mongorestore --uri="mongodb://admin:change-this-password@localhost:27017/?authSource=admin" --archive=/tmp/public_hearing_br.dump.gz --gzip
```

Sem o backup, dá para montar o banco a partir do corpus público com
`baixar_dados.py`, `importar_mongodb.py` e `chunk_transcricoes.py`. Nesse caso
as classificações de persuasão precisam ser rodadas de novo.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

No `.env`, ajuste `MONGODB_URL` (por exemplo, a porta 27018 do passo anterior) e
`OPENAI_API_KEY`, necessária só para rodar novas classificações. Depois:

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

Abra <http://localhost:3000>. O frontend usa `http://127.0.0.1:8000` como
endereço da API. Para usar outra porta, crie `frontend/.env.local` com:

```text
API_URL=http://127.0.0.1:8030
```

### Testes

```bash
cd backend && .venv/bin/python -m unittest discover -s tests -t .
```

```bash
cd frontend && npx tsc --noEmit
```

## Dados

### Corpus

O banco `public_hearing_br` tem 206 audiências (`lds`), os dados de avaliação
NLI (`nli`) e 17.261 falas (`transcript_chunks`). As classificações ficam em
`classification_jobs` e `persuasion_classification_results`.

### Pacote da Thalia

Fica em `dados/conteudo/` e não precisa de servidor: são arquivos JSON lidos pelo
frontend no servidor (`frontend/lib/thalia-data.ts`). A documentação completa está
em [`dados/conteudo/README.md`](dados/conteudo/README.md) e
[`dados/conteudo/CONTRATO.md`](dados/conteudo/CONTRATO.md).

| Arquivo | Conteúdo |
|---|---|
| `indice_audiencias.json` | uma linha por audiência, com grupo (M ou C), tema e assunto |
| `rotulos/rotulos_minorias.json` | as 8 categorias do grupo M |
| `rotulos/temas.json` | os 24 temas, exclusivos |
| `audiencias/audiencia_NNN/turnos.json` | a transcrição dividida em falas; todo dado se resolve por `turno_id` |
| `…/opinioes.json` | as posições de cada participante, ancoradas no turno |
| `…/grafo.json` | opiniões e participantes como rede |
| `…/resumo.json` | o resumo por tema, ligado às opiniões |
| `…/materia.json` | a matéria da Agência Câmara em blocos, com âncoras |
| `…/argumento_intra.json` | o que sustenta cada posição |
| `…/clausulas.json` | as ressalvas de cada posição |
| `…/dqi.json` | os sete indicadores do DQI por fala |
| `…/cobertura.json` | quem falou × quem foi citado |
| `…/proveniencia.json` | a conferência de que cada posição aponta para fala real |

Os tipos e os dados derivados estão em `frontend/lib/thalia.ts`. Para ler o pacote
de outro lugar, defina `THALIA_DATA_DIR`.

## Backend

### Classificação de persuasão

A abordagem `persuationclassifcona_7_class_few_shot` funciona assim:

1. Separa cada fala por quebras de linha e junta trechos com menos de 250
   caracteres.
2. Divide segmentos acima de 4.000 caracteres.
3. Faz uma chamada ao modelo por segmento (padrão `gpt-4o-mini`), usando os
   segmentos vizinhos só como contexto.
4. Guarda em `audit.executions` o prompt enviado e a resposta do modelo.

Evidências que não aparecem literalmente no texto ficam marcadas com
`evidence_reliable=false`.

```bash
curl -X POST "http://localhost:8000/persuasion-classifications" \
  -H "Content-Type: application/json" \
  -d '{"id": 163, "approach": "persuationclassifcona_7_class_few_shot", "experiments_tag": "minorias-001"}'
```

### Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | contagens do banco |
| GET | `/lds` | audiências paginadas |
| GET | `/lds/{id}` | uma audiência |
| GET | `/lds/{id}/chunks` | falas; com `classification_job_id`, inclui as anotações |
| GET | `/lds/{id}/persuasion-classifications` | execuções de uma audiência |
| POST | `/persuasion-classifications` | inicia uma classificação |
| GET | `/persuasion-classifications/{job_id}` | andamento |
| GET | `/persuasion-classifications/{job_id}/results` | resultados |
| GET | `/persuasion-classifications/{job_id}/summary` | técnicas por tipo de falante |
| GET | `/persuasion-classified-records` | audiências com classificação |
| GET | `/nli`, `/nli/{id}`, `/records/{id}` | dados de avaliação NLI |

Conta como parlamentar quem tem partido informado em alguma fala da audiência,
porque a filiação só aparece na primeira fala.

### Anotação humana

`exportar_anotacoes.py` e `exportar_amostra_estratificada.py` geram as
planilhas de validação. As amostras exportadas estão em `backend/outputs/`, e o
formulário de validação em `backend/google_apps_script/validacao_persuasao/`.

## Frontend

- Next.js 15, React 19, Tailwind CSS e ícones `lucide-react`.
- Páginas do servidor buscam a API direto (`lib/api-server.ts`).
- Componentes do navegador usam o proxy `/api/backend`, configurado em
  `next.config.ts`, para evitar CORS (`lib/persuasion-api.ts`).
- O conteúdo tem largura máxima de 1200px.

## Identidade visual

Segue o guia rápido da marca do Instituto Kunumi:

- **Fonte:** Figtree.
- **Cores:** grafite `#1c2127`, cinza `#f0f0f0` e coral `#ff4b3e`.
- **Degradê:** vai do preto `#060902` ao laranja `#f54d20` e ao azul `#344b7f`,
  e aparece no cabeçalho das audiências.

Os tokens estão em `frontend/tailwind.config.ts`. Os logos positivo e negativo
do Instituto Kunumi estão em `frontend/public/`.

## O que está faltando

**Dados e análises**

- [ ] **Persuasão no grupo C e no restante do grupo M.** Só 10 das 53 audiências
  do grupo M têm a persuasão classificada. Para comparar minorias × demais, é
  preciso classificar audiências do grupo C (e o resto do M), o que gera custo
  na OpenAI.
- [ ] **Painel comparativo minorias × demais.** Com o pacote da Thalia, DQI,
  cobertura e tamanho já podem ser comparados entre M e C sem custo extra.
- [ ] **Resultados da validação humana** da persuasão: concordância (kappa),
  F1 por classe e matriz de confusão humano × modelo.
- [ ] **Validação da extração de opiniões** contra o ground truth do corpus.

**Visualizações**

- [ ] **Páginas com dados demonstrativos.** "Interações entre falantes" e
  "Resumo em níveis" ainda mostram uma audiência inventada sobre transição
  energética. A página Turno a turno já cobre a rede de interação e o resumo com
  dados reais; falta decidir se as duas saem ou se viram outra coisa.
- [ ] **Camadas ainda não exibidas:** `proveniencia.json` (a conferência de cada
  posição) e as perdas registradas em `clausulas.json`.

**Home e textos**

- [ ] **Escolher a home.** A versão atual está em `/`, com quatro alternativas
  em `/previa/a` a `/previa/d`. Depois da escolha, apagar as prévias e
  `components/home/` se não forem usados.
- [ ] **Personas e histórias de uso** para a seção "Ferramenta" do artigo.
- [ ] **Rodapé.** Confirmar o texto sobre o desafio e as parcerias
  (UFMG, UFCG).

**Infraestrutura**

- [ ] **Deploy** do backend e do frontend (o frontend precisa da pasta `dados/`).
- [ ] **Testes** dos endpoints novos (`summary`, `persuasion-classified-records`)
  e do frontend.

## Licença

MIT. Veja [LICENSE](LICENSE).
