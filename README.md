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
| Prévias da home | `/previa/a` … `/previa/d` | reais; em avaliação |

A página da audiência tem um cabeçalho (assunto, data, categorias de minoria
quando houver, tema, quantas pessoas falaram, com a lista ao passar o mouse) e,
logo abaixo, a tela Turno a turno.

### Turno a turno

Inspirada na implementação de referência da Thalia e ligada ao pacote de dados
dela (206 audiências). Tudo se resolve pelo `turno_id`, e a linha do tempo filtra
todas as partes ao mesmo tempo:

- **Gráfico**, em dois modos:
  - *mapa de posições*: cada opinião no turno em que foi dita, colorida pelo
    tema do resumo. As linhas tracejadas ligam opiniões sobre o mesmo assunto;
    ficam ocultas por padrão ("ligações por tema") e sempre aparecem para a
    opinião selecionada;
  - *rede de interação*: sequência de falas, passagens de palavra (setas) e
    interrupções (✕).
- **Painel de leitura**:
  - *Transcrição*: acompanha o turno atual (mostra as 60 falas anteriores).
  - *Resumo*: cada seção acende quando ganha evidência.
  - *Matéria*: duas coisas separadas. A **cobertura na matéria original** da
    Agência Câmara (quem falou × quem foi citado, e o déficit da sociedade
    civil), calculada sem modelo, comparando nomes. E a **matéria gerada** pelo
    pipeline a partir da audiência (título, linha fina, lead e as citações mais
    representativas), feita por LLM e ainda não validada.
  - *Deliberação*: as 7 dimensões do DQI, com os trechos citados.
- **Detalhe da opinião**: mostra a fala que a sustenta (âncora), os
  fundamentos (dados, autoridades) e as ressalvas destacados no texto.
- **Linha do tempo**: play, velocidades de 0,5× a 4× e histograma do tamanho
  dos turnos. Em audiências longas (a maior tem 4.873 turnos), o histograma
  agrupa os turnos em faixas e o play avança vários turnos por passo.

### Modo persuasão

Nas audiências com persuasão classificada, o Turno a turno ganha o botão
**Modo persuasão**. Ele grifa na transcrição as técnicas encontradas pelo modelo,
com a justificativa ao passar o mouse, e conta quantas vezes cada uma apareceu
até o turno atual. As técnicas são seis e podem coexistir: ataque à reputação,
justificativa, simplificação, distração, chamada para ação e linguagem
manipulativa.

As anotações vêm da API (segmentada em trechos próprios) e são ligadas aos
turnos da Thalia procurando o texto da evidência dentro de cada fala.

Cada fala com técnicas grifadas tem o botão **Ver auditoria**, que mostra cada
chamada ao modelo: o prompt do sistema, o contexto enviado e a resposta original.
A auditoria é buscada no servidor só quando o botão é clicado.

### Selos de origem

Cada informação diz de onde vem:

- **sem modelo**: sai da estrutura da transcrição (ordem dos turnos, quem
  concede a palavra, interrupções, âncoras, cobertura por nomes);
- **via LLM**: atribuído por modelo de linguagem (DQI, exceto participação;
  fundamentos, ressalvas, persuasão, matéria gerada);
- **via modelo**: as ligações "mesmo tema", por semelhança entre os textos.

### Recorte de minorias

Segue a rotulagem da Thalia (`dados/conteudo/dados/rotulos/`): **53 audiências no
grupo M** (pautas de minorias), em 8 categorias não exclusivas, e **153 no grupo
C** (as demais). O cabeçalho de cada audiência mostra as categorias e o tema.

A persuasão foi classificada em **10 audiências do grupo M**: 20, 26, 37, 48, 85,
121, 136, 163, 176 e 180. A audiência 140 foi usada como piloto da classificação.

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
│   │   └── audiencias/[id]/turnos/    # página Turno a turno e a busca da auditoria
│   ├── components/
│   │   ├── turnos/                    # página Turno a turno
│   │   └── home/                      # partes compartilhadas das prévias
│   ├── lib/
│   │   ├── api-server.ts              # chamadas à API no servidor
│   │   ├── persuasion-api.ts          # tipos das respostas da API
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

Abra <http://localhost:3000>. O frontend (no servidor) usa `http://127.0.0.1:8000`
como endereço da API. Para usar outra porta, crie `frontend/.env.local` com:

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
| `…/materia.json` | a matéria **gerada pelo pipeline** a partir da audiência, em blocos, com âncoras (não é a matéria publicada) |
| `…/argumento_intra.json` | o que sustenta cada posição |
| `…/clausulas.json` | as ressalvas de cada posição |
| `…/dqi.json` | os sete indicadores do DQI por fala |
| `…/cobertura.json` | quem falou × quem foi citado |
| `…/proveniencia.json` | a conferência de que cada posição aponta para fala real |

Os tipos e os dados derivados estão em `frontend/lib/thalia.ts`. Para ler o pacote
de outro lugar, defina `THALIA_DATA_DIR`.

Dois detalhes do pacote que a documentação dele ainda não explica:

- os arquivos se chamam `indice_audiencias.json` e `audiencias/audiencia_NNN/`,
  não `audiencias.json` e `NNN/` como diz o README do pacote;
- o `char_start` de cada turno aponta para o cabeçalho com o nome de quem fala, e
  o `texto` começa depois dele. Por isso o frontend localiza cada trecho pelo
  próprio texto dentro da fala, em vez de subtrair os offsets.

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

- Next.js 15, React 19, Tailwind CSS e ícones `lucide-react`. Os gráficos são SVG
  feitos à mão, sem biblioteca de gráficos.
- As páginas buscam a API e leem o pacote da Thalia no servidor
  (`lib/api-server.ts` e `lib/thalia-data.ts`). A auditoria da persuasão é
  carregada sob demanda por uma server action.
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

**Decisões de escopo**

- [ ] **Ferramenta geral ou recorte?** A ferramenta funciona para qualquer
  audiência; o recorte de minorias seria o estudo de caso do artigo. Falta
  decidir como apresentar isso na home.
- [ ] **Reprodutibilidade.** Rodar o pipeline ao vivo (upload, escolha de modelo e
  parâmetros) é caro e lento, porque cada etapa usa um LLM e uma API diferentes.
  A proposta é mostrar os dados já processados e documentar como rodar o
  pipeline fora do site.
- [ ] **Escolher a home.** A versão atual está em `/`, com quatro alternativas
  em `/previa/a` a `/previa/d`. Depois da escolha, apagar as prévias e
  `components/home/` se não forem usados.

**Dados (pipeline da Thalia)**

- [ ] **Resumo e temas.** Os temas do resumo saem muito parecidos entre si. A
  proposta é usar um limite de semelhança maior (por exemplo, 0,8) e rodar o
  resumo de novo, juntando a simplificação do Robson.
- [ ] **DQI.** Rodar de novo (talvez só no recorte de minorias, porque o corpus
  inteiro leva dias) e validar com anotação humana. Seis das sete dimensões vêm
  de LLM.
- [ ] **Interrupções.** Conferir os casos marcados: parte deles pode ser fala de
  alguém não identificado ou manifestação da plateia.
- [ ] **Interrupções × minorias (H1).** Calcular se convidados são mais
  interrompidos nas audiências do grupo M.
- [ ] **Fundamentos.** Alguns trechos em "o que sustenta a posição" não fazem
  sentido; conferir o `argumento_intra.json`.
- [ ] **Modelo de embeddings.** O `manifest.json` não registra qual modelo gerou
  as ligações "mesmo tema", nem o limite usado (os pesos vão de 0,55 a 1,0).

**Persuasão e validação**

- [ ] **Persuasão no grupo C e no restante do grupo M.** Só 10 das 53 audiências
  do grupo M têm a persuasão classificada. Para comparar minorias × demais, é
  preciso classificar mais audiências, o que gera custo na OpenAI.
- [ ] **Resultados da validação humana** da persuasão: concordância (kappa),
  F1 por classe e matriz de confusão humano × modelo.
- [ ] **Validação das opiniões.** Comparar com as opiniões do dataset é injusto,
  porque elas vêm da matéria publicada, que inclui informação de fora da
  audiência. Falta definir outra forma de validar.
- [ ] **Matéria gerada.** Não foi validada; pode ficar como extra ou trabalho
  futuro.

**Visualizações**

- [ ] **Painel comparativo minorias × demais.** DQI, cobertura e tamanho já podem
  ser comparados entre M e C com o pacote da Thalia, sem custo extra.
- [ ] **Persuasão por tipo de falante.** O endpoint
  `/persuasion-classifications/{job_id}/summary` (parlamentares × convidados)
  existe, mas deixou de ser exibido quando a página de argumentação saiu.
- [ ] **Camadas ainda não exibidas:** `proveniencia.json` (a conferência de cada
  posição) e as perdas registradas em `clausulas.json`.

**Textos**

- [ ] **Personas e histórias de uso** para a seção "Ferramenta" do artigo.
- [ ] **Rodapé.** Confirmar o texto sobre o desafio e as parcerias
  (UFMG, UFCG).

**Infraestrutura**

- [ ] **Deploy** do backend e do frontend (o frontend precisa da pasta `dados/`).
- [ ] **Testes** dos endpoints novos (`summary`, `persuasion-classified-records`)
  e do frontend.

## Licença

MIT. Veja [LICENSE](LICENSE).
