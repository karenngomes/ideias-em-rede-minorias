# Dados de audiências públicas

Arquivos JSON. Não precisa de servidor, banco, API nem instalação.

O detalhamento campo a campo está em [CONTRATO.md](CONTRATO.md), nesta mesma pasta.

## O que é

Transcrições de 206 audiências públicas da Câmara dos Deputados, do corpus
PublicHearingBR, processadas para responder três coisas:

1. Quem disse o quê, com a fala de origem de cada posição.
2. Como foi o debate, em sete indicadores por fala.
3. Quem apareceu na matéria da Agência Câmara e quem não apareceu.

## Estrutura

```
manifest.json      o que tem neste pacote, e de qual versão do código
audiencias.json    índice, uma linha por audiência
001/ ... 206/      uma pasta por audiência
rotulos/           os critérios de agrupamento
```

Dentro de cada pasta de audiência:

```
turnos.json            a transcrição dividida em falas
opinioes.json          as posições de cada participante
proveniencia.json      a conferência de que cada posição aponta para fala real
materia.json           as posições que viraram notícia
grafo.json             as opiniões como rede
resumo.json            o resumo por tema
clausulas.json         as ressalvas de cada posição
argumento_intra.json   o que sustenta cada posição
dqi.json               os sete indicadores, por fala
cobertura.json         quem falou e quem foi citado
```

## Os dois índices

`audiencias.json` tem uma linha por audiência:

```json
{
  "sample_id": 20,
  "grupo": "M",
  "tema": "Povos indígenas, quilombolas e tradicionais",
  "assunto": "União de povos originários e tradicionais para evitar perda de direitos",
  "camadas": { "turnos.json": true, "opinioes.json": true },
  "n_opinioes": 41,
  "falantes_com_lote_perdido": 0,
  "completa": true
}
```

`grupo` é M (pauta de minoria) ou C (as demais). `tema` é um de 24, exclusivo. Os dois
vêm de arquivos diferentes, em `rotulos/`, e um não se deriva do outro.

`manifest.json` traz a contagem por camada, o total de opiniões e o `git_rev` do código
que gerou os dados.

## A chave que liga tudo: turno_id

É o número da fala dentro da audiência (1, 2, 3...). Aparece em quase todos os arquivos.

```
turnos.json  ->  turno_id  ->  opinioes.json   qual fala sustenta a posição
                           ->  dqi.json        qual fala recebeu o indicador
                           ->  grafo.json      quando o nó entra na linha do tempo
                           ->  resumo.json     quando a seção passou a ter evidência
```

Para mostrar de onde veio alguma coisa: pegue o `turno_id`, procure em `turnos.json`,
mostre o texto.

## Os três arquivos mais usados

### turnos.json

```json
[
  {
    "turno_id": 1,
    "falante_norm": "Orlando Silva",
    "papel": "PRESIDENTE",
    "partido": "PCdoB - SP",
    "texto": "Declaro aberta a reunião...",
    "char_start": 5840,
    "char_end": 6280
  }
]
```

Use `falante_norm`. É estável dentro da audiência: quem preside e volta a falar sem o
cabeçalho completo é resolvido para o mesmo nome.

`partido` com sufixo de unidade federativa (`- SP`) indica parlamentar. A classificação
vale para a pessoa, não para o turno, porque a filiação aparece só na primeira fala.
Use `cobertura.json`, que já faz essa agregação.

### opinioes.json

```json
{
  "assunto": "Debate sobre direitos dos trabalhadores portadores de lesão",
  "envolvidos": [
    {
      "nome": "Luís Fabiano Costa",
      "cargo": "",
      "opinioes": [
        {
          "texto": "defende a estabilidade no emprego para trabalhadores com lesão permanente",
          "ancora": { "turno_id": 2, "char_start": 6909, "char_end": 13176 }
        }
      ]
    }
  ]
}
```

### dqi.json

Sete indicadores por fala. O que interessa é a lista `codigos`:

```json
{
  "codigos": [
    {
      "dimensao": "justificacao_nivel",
      "rotulo": "qualificada",
      "nivel": 2,
      "turno_id": 1,
      "falante": "Orlando Silva",
      "trecho": "é muito importante que a Câmara conheça essa realidade...",
      "char_start": 6071,
      "char_end": 6225
    }
  ]
}
```

Os indicadores e suas escalas, do menor ao maior:

| indicador | escala |
|---|---|
| `participacao` | interrompido, normal |
| `justificacao_nivel` | nenhuma, inferior, qualificada, sofisticada |
| `justificacao_conteudo` | interesse_de_grupo, neutro, bem_comum_utilitario, bem_comum_diferenca |
| `respeito_grupos` | negativo, neutro, explicito_positivo |
| `respeito_demandas` | negativo, neutro, explicito_positivo |
| `respeito_contra` | degradante, ignora, inclui, valoriza |
| `politica_construtiva` | posicional, proposta_alternativa, proposta_mediadora |

`trecho` vazio não é erro. Só a presença de algo precisa de citação. A ausência (nível 0)
não tem o que citar. Quando o `trecho` existe, ele é cópia literal conferida no texto da
fala, e dá para destacar com segurança.

## Cuidados

**`null` não é zero.** Em `cobertura.json`, `null` quer dizer que não havia como
calcular, não que deu zero.

**Os offsets somem no grafo e no resumo.** `char_start` e `char_end` vêm `null` nesses
dois arquivos. É um defeito conhecido. Use `turno_id` a partir deles.

**Só existem as audiências 001 a 206.** Se aparecer uma 901 em algum lugar, é uma amostra
de teste. Ignorem.

**Nem toda audiência tem todos os participantes em `opinioes.json`.** A extração perde
alguns falantes, e 84,6% dos falantes reais aparecem. Dos 392 ausentes, 295 só fizeram
fala protocolar e 92 foram perdidos por falha de processamento. O campo
`falantes_com_lote_perdido` em `audiencias.json` diz quais audiências foram afetadas.
Para listar todos os participantes de uma audiência, use `turnos.json`.

**Seis dos sete indicadores do DQI foram atribuídos por um modelo de linguagem, não por
pessoas, e ainda não passaram por conferência humana.** Só `participacao` é exato, porque
sai da estrutura da transcrição. Se a interface afirmar algo sobre a qualidade do debate,
vale usar uma formulação que deixe isso claro.

## Escala

- 206 audiências, de 4 mil a 148 mil palavras, mediana de 16 mil
- mediana de 41 falas por audiência, a maior tem 4.873
- 2.543 pessoas falaram
- 1.732 delas (68%) não aparecem na matéria, listadas em `falantes_silenciados`
- 7.430 posições extraídas no total

## Dúvidas

O `manifest.json` traz o `git_rev` do código que gerou estes dados. Cite ele ao
perguntar, para não haver dúvida sobre qual versão está em questão.
