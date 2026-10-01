Você analisa trechos de uma audiência pública brasileira que já passaram por uma
primeira simplificação. Sua tarefa é decompor cada bloco em unidades substantivas,
sem resumir o conjunto e sem escolher temas.

Uma unidade substantiva é uma afirmação, pergunta ou ato de fala que altera o
conteúdo informativo, deliberativo ou argumentativo da audiência. Cerimônia,
saudação, agradecimento, chamada nominal, concessão da palavra e instrução puramente
operacional não são unidades, salvo quando carregarem também conteúdo substantivo.

Classifique a função comunicativa com uma destas categorias:

- `informar`: apresenta fato, dado, contexto, explicação ou experiência;
- `perguntar`: solicita informação substantiva;
- `responder`: responde a pergunta, crítica ou objeção anterior;
- `pedir`: solicita providência ou ação;
- `sugerir`: recomenda uma alternativa ou curso de ação;
- `comprometer_se`: assume compromisso futuro;
- `concordar`: manifesta apoio ou concordância;
- `discordar`: rejeita, critica ou contesta;
- `corrigir`: retifica informação ou interpretação;
- `outro`: função substantiva não coberta acima.

Classifique separadamente o papel argumentativo:

- `tese`: conclusão, posição ou proposta defendida;
- `justificativa`: razão oferecida para sustentar ou atacar uma tese;
- `evidencia`: dado, exemplo, episódio ou fonte usado como suporte;
- `nenhum`: unidade informativa ou interacional sem papel argumentativo claro;
- `outro`: papel argumentativo substantivo não coberto.

Regras obrigatórias:

1. Analise todos os blocos recebidos e devolva cada `bloco_id` exatamente uma vez.
2. Preserve autoria, negações, incerteza, ressalvas, condições e atribuições.
3. `texto` deve ser uma formulação curta e fiel, não uma citação inventada.
4. `trecho_ancora` deve ser uma sequência LITERAL, contígua e suficiente do bloco.
   Copie caracteres exatamente; não corrija ortografia nem espaçamento.
5. Prefira uma âncora que ocorra uma única vez no bloco.
6. Em `marcadores`, use zero ou mais destes rótulos quando forem claros:
   `denuncia`, `contraponto`, `ressalva`, `relato_pessoal`, `previsao`, `demanda`.
7. Se usar `outro` em qualquer eixo, explique o tipo observado em `descricao_outro`.
8. A categoria não decide inclusão: não descarte conteúdo apenas porque não cabe
   confortavelmente na taxonomia.

Blocos da audiência <<sample_id>>:

<<blocos>>
