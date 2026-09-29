# Mocks dos dados da Thalia

Audiência **fictícia 901**. A documentação dos dados reserva esse número para
testes: as audiências reais vão de 001 a 206. Os nomes, falas e números foram
inventados. Estes dados servem só para desenvolver as visualizações enquanto os
arquivos reais não chegam.

Os arquivos seguem o formato documentado pela Thalia:

| arquivo | uso na interface |
|---|---|
| `turnos.json` | texto original de cada turno; todo dado se resolve por `turno_id` |
| `opinioes.json` | opiniões por participante, ancoradas no turno que as sustenta |
| `dqi.json` | códigos das 7 dimensões do DQI por turno (`fonte: "exato"` só em `participacao`) |
| `cobertura.json` | quem falou × quem a matéria citou (`deficit_civil`, `falantes_silenciados`) |
| `grafo.json` | nós participante/opinião e arestas `emitiu`, `fala_apos`, `concede_palavra`, `mesmo_tema` |
| `resumo.json` | seções do resumo apontando para os nós do grafo (`deriva_de`) |
| `clausulas.json` | recortes finos para destacar dentro da fala. **O formato é suposto**, porque não estava na documentação |

Os mocks reproduzem as ressalvas da documentação: `char_start`/`char_end` vêm
`null` em `grafo.json` e `resumo.json`, e o nível 0 de cada dimensão do DQI não
tem trecho citado.
