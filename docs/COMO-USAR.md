# Guia rápido — do primeiro material ao primeiro simulado

Um roteiro de 10 minutos para experimentar o Study Flux. A conta demo (`demo@studyflux.app` / `estudar123`) já vem com tudo preenchido; se quiser começar do zero, crie uma conta ou use **Configurações → resetar dados** (via `npm run reset`).

---

## 1. Entre e olhe o painel

Na tela de login, clique em **Entrar como demo**.

Você vai ver:

- **Meta diária** (quantas questões faltam para bater a meta).
- **Sequência** de dias com estudo.
- **Cards de revisão** vencidos (no menu lateral, o número ao lado de “Revisão espaçada”).
- **Temas para reforçar**, calculados a partir dos seus erros.

O botão principal é **Montar simulado**; o secundário é **Enviar material**.

---

## 2. Envie um material

Menu **Materiais → Novo material**. Você tem duas opções:

### a) Enviar arquivo
PDF (com texto selecionável), DOCX, TXT ou MD — até 25 MB.

**O que funciona melhor:**

| Tipo de material | O que a plataforma faz |
| --- | --- |
| **Prova antiga com gabarito** | Reaproveita as questões na íntegra e monta blocos com correção comentada. É o modo de maior fidelidade. |
| **Capítulo com subtítulos** (Definição, Quadro clínico, Diagnóstico, Tratamento) | Monta perguntas de completar por seção, citando o trecho original. |
| **Resumo em texto corrido** | Funciona, mas gera menos perguntas e menos precisas. Vale formatar com títulos. |
| **PDF escaneado (foto)** | Não é lido (sem OCR). A plataforma avisa; cole o texto ou use um PDF digital. |

### b) Colar texto
Ideal para o resumo do grupo, anotações da aula ou questões copiadas.

Depois de enviar, você cai na tela do material.

---

## 3. Confira o que a plataforma entendeu

A tela do material tem três blocos:

1. **O que identificamos** — palavras, tempo de leitura, questões/gabarito, temas reconhecidos, condições citadas e a estrutura (seções e quantos trechos úteis há em cada uma). Se algo estiver estranho, clique em **Reanalisar** ou ajuste o arquivo original.
2. **Prévia do que será gerado** — cada bloco com suas perguntas e alternativas, com a correta destacada. Veja antes de criar.
3. **Avisos** — por exemplo, “encontramos questões, mas nenhum gabarito”.

> **Dica:** se a prévia estiver vazia, o material provavelmente não tem subtítulos nem questões identificáveis. Com IA ativada, a prévia estruturada não é o único caminho.

---

## 4. Gere os casos

Clique em **Gerar casos**. Você escolhe:

- **Automático** — usa IA se estiver configurada; senão, usa o modo estruturado.
- **Estruturado (sem IA)** — perguntas de completar + provas antigas. Sempre disponível.
- **Somente IA** — casos clínicos completos (exige chave configurada).

Defina a quantidade (1–8) e se os casos já entram **publicados** ou como rascunho.

Ao terminar, aparece o resumo (criados/atualizados) e os links dos casos. Regerar o mesmo material **atualiza** os casos em vez de duplicar — seu histórico de respostas é preservado.

---

## 5. Treine um caso

Na **Biblioteca**, encontre um caso e clique em **Treinar**.

- O prontuário fica sempre visível (pode recolher).
- Escolha uma alternativa e confirme.
- O feedback mostra se acertou, qual era a correta, a justificativa e o **trecho do material** que sustenta a resposta.
- Atalhos: **1–5** escolhem, **Enter** confirma e avança.
- No fim: aproveitamento, revisão de cada pergunta e o botão para refazer.

---

## 6. Faça um simulado

Menu **Simulado**: escolha a área e a quantidade de casos (3, 5 ou 8).

- Sem correção durante o percurso — como em uma prova.
- O resultado aparece no final, por caso, com opção de revisar.
- Encerrar antes da hora mantém no histórico o que já foi respondido.

---

## 7. Revise no dia seguinte

Menu **Revisão espaçada**.

- Cada card é uma pergunta que você errou (ou marcou como difícil).
- Clique no card para ver a resposta; depois diga como foi: **Errei / Difícil / Bom / Fácil**.
- O algoritmo agenda a próxima revisão: erros voltam amanhã, acertos fáceis demoram mais.
- Você pode revisar tudo de uma vez ou apenas os vencidos.

---

## 8. Leia o seu progresso

Menu **Progresso**.

- **Acerto por área** e por tema.
- **Precisa reforçar** (até 75%) e **Pontos fortes**.
- **Constância** dos últimos 14 dias e meta diária.
- **Histórico** expansível: cada treino mostra as perguntas e se você acertou.
- **Exportar CSV** para analisar no Excel/Sheets ou levar para orientação.

Use os temas frágeis para decidir o próximo simulado.

---

## 9. Configure a IA (opcional)

**Configurações → Geração por IA**:

1. Ative **Usar IA**.
2. Escolha o provedor (OpenAI, Anthropic ou API compatível).
3. Confira a URL (vem preenchida por padrão).
4. Cole a chave de API (ela é criptografada e não aparece de volta).
5. Clique em **Testar conexão**; se funcionar, **Listar modelos** e escolha um.
6. **Salvar**.

Sem chave, tudo continua funcionando no modo estruturado. Ao gerar com IA, apenas o texto do material é enviado ao provedor.

---

## 10. Crie um caso manualmente (quando quiser)

**Biblioteca → Novo caso**. O editor permite:

- Identificação: título, área, tema, dificuldade, formato, tempo.
- Apresentação: paciente, queixa, história, antecedentes, exame físico, sinais vitais, exames e imagem/laudo.
- Perguntas: 3 a 5 alternativas, marcação da correta, justificativa, ponto-chave e trecho da fonte.
- Pontos-chave e publicação.

Use para transformar um caso discutido em aula em material treinável.

---

## Rotina sugerida de uma semana

| Dia | 20–40 minutos |
| --- | --- |
| Segunda | Enviar o material da semana + gerar casos |
| Terça | Treinar 2 casos + revisão do dia |
| Quarta | Simulado curto (3 casos) |
| Quinta | Revisão espaçada + treinar os temas frágeis |
| Sexta | Novo material da próxima prova + gerar casos |
| Sábado | Simulado maior (5–8 casos) |
| Domingo | Só revisão (leve) |

O objetivo não é acumular casos: é **errar, entender e revisar**.

---

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| “Extraímos pouco texto” | O PDF é escaneado. Cole o texto ou use uma versão digital. |
| Prévia vazia | Material sem subtítulos e sem questões. Formate com títulos ou ative a IA. |
| Não encontro o gabarito | A prova pode estar sem gabarito. Sem ele, o modo estruturado não reaproveita as questões — use IA. |
| Geração por IA falha | Teste a conexão em Configurações; confira chave, URL e se o modelo existe. |
| Errei e quero refazer | Abra o caso → **Treinar** novamente. Ou use o histórico no Progresso. |
| Quero apagar tudo e recomeçar | `npm run reset` (apaga o banco local) e reinicie. |
