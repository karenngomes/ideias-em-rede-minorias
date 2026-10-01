# Protótipo de validação de persuasão

Este projeto deve ser criado como um Apps Script vinculado à planilha que contém a aba `Tarefas`.

## Planilha compatível

O app foi conferido com `outputs/amostra-minorias-estratificada-cardinalidade-130-anotacoes.xlsx`. Nela, a aba `Tarefas` possui 65 trechos e `anotadores_necessarios = 2`, portanto o estudo é concluído com 130 atribuições finalizadas por pares de e-mails distintos. Importe o arquivo como Planilha Google sem renomear a aba `Tarefas` nem os cabeçalhos.

## Instalação

1. Na Planilha Google, abra **Extensões > Apps Script**.
2. Substitua o conteúdo de `Code.gs` pelo conteúdo deste `Code.gs`.
3. Crie um arquivo HTML chamado `Index` e cole o conteúdo de `Index.html`.
4. Em **Configurações do projeto**, marque a opção para mostrar o arquivo de manifesto.
5. Substitua `appsscript.json` pelo manifesto deste diretório.
6. Execute manualmente `setupValidationSheets` uma vez e autorize o acesso.
7. Clique em **Implantar > Nova implantação > Aplicativo da Web**.
8. Execute como **você** e permita acesso a qualquer pessoa com o link.
9. Abra a URL gerada e faça uma avaliação de teste.

O protótipo cria e utiliza as abas `Participantes`, `Respostas_Paragrafos`, `Anotacoes_Humanas`, `Avaliacoes_LLM` e `Atribuicoes`. Participantes pré-cadastrados selecionam diretamente a própria identificação; somente quem escolher `Outro` informa nome e e-mail. Internamente, cada participante possui um identificador único que associa cadastro, progresso e distribuição. Cada tarefa é distribuída aleatoriamente entre as menos cobertas para dois participantes distintos, conforme a coluna `anotadores_necessarios` da aba `Tarefas`, permitindo calcular concordância e kappa. O mesmo participante nunca recebe a mesma tarefa duas vezes. A coluna `status` de `Tarefas` fica como `Pendente` sem conclusões, `Em andamento` após a primeira conclusão e `Concluída` ao atingir o número de anotadores necessários. A resposta da LLM só aparece depois que a anotação humana independente foi salva; se a página for recarregada nesse ponto, a avaliação da LLM é retomada sem duplicar a anotação humana. Ao concluir o parágrafo e avaliar a LLM, a pessoa escolhe entre continuar ou salvar e finalizar.

Para criar uma amostra multilabel estratificada com pelo menos 15 exemplos de cada classe:

```bash
python exportar_amostra_estratificada.py \
  --job-id JOB_1 --job-id JOB_2 \
  --min-per-class 15 \
  --output outputs/amostra_multilabel.xlsx
```

Cada parágrafo multilabel conta simultaneamente para todas as suas classes. O arquivo exportado registra a cobertura na aba `Estratificacao` e solicita duas anotações humanas independentes por tarefa.
