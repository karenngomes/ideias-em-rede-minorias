# Contrato de consumo

Referência campo a campo. Para começar, leia o [README.md](README.md).

## Layout

```
manifest.json      o que tem neste pacote
audiencias.json    índice, uma linha por audiência
001/ ... 206/      uma pasta por audiência
rotulos/           os critérios de agrupamento
```

Três camadas existem em todas as 206 audiências:

```
turnos.json       a transcrição segmentada
dqi.json          os sete indicadores, por fala
cobertura.json    quem falou e quem foi citado
```

Sete dependem da extração:

```
opinioes.json          as posições atribuídas, com âncora
proveniencia.json      a verificação da cadeia posição para turno
materia.json           as posições que viraram notícia
grafo.json             o grafo de discurso
resumo.json            o resumo por tema
resumo_ancorado.json   nova síntese, com proveniência por frase
unidades_resumo.json   unidades e âncoras da nova síntese
interrupcoes.json      eventos observáveis de interrupção
clausulas.json         as ressalvas de cada posição
argumento_intra.json   o que sustenta cada posição
```

As três novas camadas são aditivas. `resumo.json` e a antiga dimensão
`participacao` de `dqi.json` continuam no pacote enquanto o front migra para os
novos contratos.

## resumo_ancorado.json e unidades_resumo.json

`resumo_ancorado.json` organiza a audiência em seções. Diferentemente do resumo
anterior, a proveniência está em cada frase:

```json
{
  "secoes": [
    {
      "id": "t::005::01",
      "titulo": "Efetivação dos direitos das pessoas autistas",
      "frases": [
        {
          "texto": "A audiência discutiu atendimento e educação inclusiva.",
          "deriva_de": ["u::005::00003", "u::005::00005"]
        }
      ]
    }
  ]
}
```

Cada identificador de `deriva_de` deve existir em `unidades_resumo.json`. A unidade
contém `falante`, `funcao_comunicativa`, `papel_argumentativo`, `texto`,
`trecho_ancora`, `ancora_simplificacao` e `ancora_original`. Quando a âncora original
foi localizada, `ancora_original.turno_id` liga a frase à transcrição em
`turnos.json`.

## interrupcoes.json

Contém `variantes` (`atual`, `registrada`, `substantiva` e `ampla`) e `eventos`.
A leitura principal é `substantiva`: exclui problemas técnicos e gestão de tempo.
Cada evento registra o turno-alvo, as pessoas envolvidas, o tipo, a origem, a
retomada, a reposição de tempo, o trecho e o offset disponível. É uma análise
determinística exploratória, não uma verdade de campo validada por anotadores.

`manifest.json` traz `cobertura_por_camada` com a contagem exata de cada uma.

## turnos.json

Lista de turnos em ordem. Os offsets são posições na transcrição bruta do corpus.

```json
[
  {
    "turno_id": 1,
    "falante_raw": "PRESIDENTE",
    "falante_norm": "Orlando Silva",
    "papel": "PRESIDENTE",
    "partido": "PCdoB - SP",
    "texto": "Declaro aberta a presente reunião...",
    "char_start": 5840,
    "char_end": 6280
  }
]
```

| campo | |
|---|---|
| `falante_raw` | como aparece na transcrição |
| `falante_norm` | a identidade resolvida, estável dentro da audiência. Use este |
| `papel` | `PRESIDENTE` quando o cabeçalho traz papel, senão `null` |
| `partido` | filiação, ou `null`. Sufixo `- UF` indica parlamentar |

A classificação parlamentar vale para a pessoa, não para o turno. A filiação aparece na
primeira fala e some depois. `cobertura.json` já faz essa agregação.

## opinioes.json

```json
{
  "assunto": "Debate sobre mudanças na legislação para assegurar direitos dos trabalhadores portadores de lesão",
  "envolvidos": [
    {
      "nome": "Luís Fabiano Costa",
      "cargo": "",

      "opinioes": [
        {
          "texto": "defende a estabilidade no emprego para trabalhadores com lesão permanente até a aposentadoria",
          "ancora": {
            "turno_id": 2,
            "chunk_id": "turno_0002",
            "node_id": null,
            "char_start": 6909,
            "char_end": 13176
          },
          "nucleo": "",
          "qualificadores": []
        }
      ],

      "falas": [
        {
          "turno_id": 2,
          "tipo": "exposicao",
          "resumo": "Relata dados do Observatório de Segurança e Saúde no Trabalho..."
        }
      ],

      "protocolo": [20],
      "resumo_geral": "Luís Fabiano Costa falou como representante de trabalhadores metalúrgicos..."
    }
  ]
}
```

`opinioes` são as posições, e é o que vira matéria, grafo e resumo. `falas` é mais largo:
cobre também o que a pessoa expôs sem tomar posição. `tipo` pode ser `exposicao`,
`posicionamento`, `pergunta` ou `resposta`. `protocolo` lista os turnos que são só
cortesia ou encaminhamento.

`nucleo` e `qualificadores` só são preenchidos quando a camada de cláusulas rodou.

### O que é garantido por construção

Verificado por testes, não por avaliação:

1. Nenhum participante é inventado. O nome é passado ao modelo, não pedido dele.
2. A âncora aponta para fala da pessoa certa. Uma posição só pode ancorar num turno
   daquela pessoa, e o código rejeita o resto.

### O que não é garantido

A âncora garante que a posição aponta para uma fala real da pessoa certa. Não garante que
seja leitura fiel daquela fala. Isso foi medido à parte e deu 94,9%, sobre 59 afirmações
de 6 audiências.

### Sobre os offsets

`char_start` e `char_end` em `opinioes.json` costumam recortar o turno inteiro, não a
frase. Para destacar dentro da fala, use `clausulas.json`, onde o recorte é fino.

Em `grafo.json` e `resumo.json` os offsets vêm sempre `null`. É um defeito conhecido: a
desserialização perde o campo. Use `turno_id` a partir desses dois arquivos.

## dqi.json

Sete indicadores, avaliados por turno. Turno com menos de 50 palavras não é codificado,
porque é protocolo.

```json
{
  "sample_id": 67,
  "n_turnos": 21,
  "n_turnos_codificados": 12,
  "n_codigos": 84,
  "n_rejeitados": 0,

  "codigos": [
    {
      "dimensao": "justificacao_nivel",
      "nivel": 2,
      "rotulo": "qualificada",
      "turno_id": 1,
      "falante": "Orlando Silva",
      "trecho": "Por isso, é muito importante que a Câmara dos Deputados conheça essa realidade...",
      "char_start": 6071,
      "char_end": 6225,
      "fonte": "modelo"
    }
  ],

  "rejeitados": [],
  "agregado": {}
}
```

Consuma `codigos`. `agregado` é conveniência derivada dele.

| indicador | escala, do nível 0 ao máximo |
|---|---|
| `participacao` | interrompido, normal |
| `justificacao_nivel` | nenhuma, inferior, qualificada, sofisticada |
| `justificacao_conteudo` | interesse_de_grupo, neutro, bem_comum_utilitario, bem_comum_diferenca |
| `respeito_grupos` | negativo, neutro, explicito_positivo |
| `respeito_demandas` | negativo, neutro, explicito_positivo |
| `respeito_contra` | degradante, ignora, inclui, valoriza |
| `politica_construtiva` | posicional, proposta_alternativa, proposta_mediadora |

`fonte` é `exato` ou `modelo`. Só `participacao` é exato: ela sai da ordem dos turnos, sem
modelo nenhum. Se a interface distinguir os dois visualmente, essa é a distinção que
importa.

`trecho` vazio não é falha. Nível 0 é ausência e não tem o que citar, e `participacao`
nunca cita porque a evidência dela é a ordem dos turnos. Quando há trecho, ele é cópia
literal conferida no texto da fala.

`rejeitados` guarda o que não passou na conferência, com o texto junto. No corpus inteiro
foram 156 de 49.110 códigos.

## cobertura.json

```json
{
  "sample_id": 67,
  "n_falantes": 6,
  "n_parlamentares": 1,
  "n_convidados": 5,

  "proporcoes": {
    "com_mesa": {
      "participacao_civil_palavras": 0.626,
      "citacao_civil_opinioes": 0.875,
      "deficit_civil": -0.249
    },
    "sem_mesa": {}
  },

  "citados_ausentes": [],
  "falantes_silenciados": [],
  "falantes": [
    {
      "nome": "Maria da Silva",
      "parlamentar": false,
      "mesa": false,
      "n_turnos": 4,
      "n_palavras": 1820,
      "turnos": [3, 7, 12, 19]
    }
  ]
}
```

| campo | |
|---|---|
| `participacao_civil_palavras` | fração das palavras faladas que é de convidados |
| `citacao_civil_opinioes` | fração das posições da matéria atribuída a convidados |
| `deficit_civil` | a primeira menos a segunda. Positivo significa que a sociedade civil fala mais do que aparece |
| `citados_ausentes` | pessoas citadas na matéria que não falaram na sessão |
| `falantes_silenciados` | pessoas que falaram e a matéria não citou |
| `com_mesa` / `sem_mesa` | com e sem quem preside |

Use `com_mesa`. A variante `sem_mesa` é degenerada em 37% do corpus, porque tirar quem
preside tira o único parlamentar que fala, e o déficit vira zero.

Qualquer campo numérico pode vir `null`, e `null` não é zero. Significa que não havia
denominador.

## grafo.json e resumo.json

Dois tipos de nó:

```json
{
  "nos": [
    {
      "id": "p::Orlando Silva",
      "tipo": "participante",
      "rotulo": "Orlando Silva",
      "dados": { "cargo": "...", "n_opinioes": 3 }
    },
    {
      "id": "o::0000",
      "tipo": "opiniao",
      "rotulo": "defende a realização de debate sobre trabalhadores lesionados",
      "dados": {
        "falante": "Orlando Silva",
        "turno_id": 1,
        "char_start": null,
        "char_end": null,
        "qualificadores": []
      }
    }
  ],
  "arestas": [
    { "origem": "p::Orlando Silva", "destino": "o::0000", "tipo": "emitiu", "peso": 1.0 }
  ]
}
```

| aresta | liga | origem |
|---|---|---|
| `emitiu` | participante para opinião | exata |
| `fala_apos` | participante para participante | exata, da ordem dos turnos |
| `concede_palavra` | participante para participante | exata, de quem preside |
| `mesmo_tema` | opinião para opinião | semântica, por similaridade |

As três primeiras não passam por modelo. No corpus inteiro: 4.074 arestas de `fala_apos`,
1.585 de `concede_palavra` em 167 audiências, e 42.042 de `mesmo_tema`.

`resumo.json`:

```json
{
  "secoes": [
    {
      "titulo": "Estabilidade e benefícios para lesionados",
      "sintese": "Luís Fabiano Costa defendeu a estabilidade no emprego...",
      "participantes": ["Antônio Benedito Gonçalves", "Luís Fabiano Costa"],
      "deriva_de": ["o::0004", "o::0007"],
      "posicoes": [
        { "falante": "...", "texto": "...", "turno_id": 2, "qualificadores": [] }
      ]
    }
  ],
  "cobertura": { "participantes": 5, "participantes_total": 5, "taxa_participantes": 1.0 }
}
```

`deriva_de` casa com `nos[].id` do grafo. `taxa_participantes` é sempre 1.0. Se vier
diferente, é defeito do nosso lado, e vale avisar.

### Linha do tempo

Cada nó carrega o `turno_id`, então:

```
grafo no instante T  ==  grafo completo filtrado por turno_id <= T
```

Não precisa de chamada por quadro. Duas regras que vale respeitar: a aresta `mesmo_tema`
liga opiniões distantes e só deve aparecer no maior dos dois turnos, para que o grafo só
cresça; e o resumo foi escrito sobre a sessão inteira, então não existe resumo de um
turno, existe o instante em que cada seção passou a ter evidência.

Há uma implementação de referência no repositório de origem, e ela é só leitura.

## rotulos/

Dois arquivos, independentes um do outro.

`rotulos_minorias.json` define o grupo M, com oito categorias não exclusivas. Uma
audiência pode estar em mais de uma. São 53 audiências em M e 153 em C.

`temas.json` define uma partição de 24 temas. Cada audiência tem exatamente um.

Os dois trazem o critério e a procedência. Nenhum dos dois passou por revisão de uma
segunda pessoa ainda, e os arquivos declaram isso.

## Cuidados

| | |
|---|---|
| `null` nunca é zero | em `cobertura.json` significa que não havia denominador |
| offsets `null` no grafo e no resumo | defeito conhecido, use `turno_id` |
| a amostra 901 não existe | é uma amostra de teste, e não está neste pacote |
| formato v1 | `manifest.json` lista as audiências extraídas com o prompt antigo, que tem posições a mais |
| 84,6% dos falantes em `opinioes.json` | ver `falantes_com_lote_perdido` em `audiencias.json`. Para a lista completa de participantes, use `turnos.json` |
| seis dos sete indicadores do DQI vêm de modelo | sem conferência humana até agora. Só `participacao` é exato |
| encoding | tudo UTF-8, sem escapes `\uXXXX` |

## Números de contexto

- 206 audiências, de 4.437 a 147.728 palavras, mediana de 16.519
- mediana de 41 turnos por audiência, a maior tem 4.873
- 2.543 falantes, dos quais 1.732 (68,1%) nunca citados na matéria
- 7.430 posições extraídas
- 49.110 códigos de DQI, com 156 rejeitados na conferência
