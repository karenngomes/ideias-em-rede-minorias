# Mocks dos dados da Thalia

Audiência **fictícia 901**, sobre racismo institucional no acesso à saúde:
23 turnos, 8 participantes (4 parlamentares e 4 convidadas/os), 17 opiniões em
4 temas e 30 códigos de DQI. A documentação dos dados reserva o número 901 para
testes: as audiências reais vão de 001 a 206. Nomes, falas e números foram
inventados, e servem só para desenvolver a página **Turno a turno** enquanto os
arquivos reais não chegam.

Os arquivos são gerados por `gerar_mock.py`, que confere que cada trecho do DQI é
literal e que cada opinião ancora numa fala da pessoa certa:

```bash
python3 data/mocks/gerar_mock.py
```

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
