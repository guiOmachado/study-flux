# Análise de produto — Study Flux

Este documento explica **por que** a plataforma foi desenhada assim, o que foi priorizado nesta primeira versão e como o produto pode evoluir de medicina para outras profissões.

---

## 1. Contexto e problema

### O que acontece hoje no período de provas

O estudante de medicina tem três ativos e três restrições:

| Ativos | Restrições |
| --- | --- |
| Material próprio (capítulos, resumos, provas anteriores, cadernos) | Tempo curto até a prova |
| Aulas e professores que sinalizam o que cai | Volume grande de conteúdo |
| Acesso a bancos de questões genéricos | Pouco tempo para transformar material em treino |

O comportamento padrão é **reler e grifar** — uma estratégia confortável, mas de baixa eficiência para retenção. A literatura de aprendizagem aponta repetidamente que **recuperação ativa** (responder perguntas) e **repetição espaçada** produzem retenção muito superior à releitura, especialmente em conteúdo denso como fisiopatologia e conduta.

### Onde as soluções atuais falham

1. **Bancos de questões tradicionais** têm volume, mas não conversam com o material da faculdade. O aluno estuda o capítulo X e treina o tema Y.
2. **Ferramentas de IA genéricas** geram perguntas rápidas, porém: não têm progressão clínica, não citam a fonte, não registram erro, não revisam depois e frequentemente inventam dados (dosagem, valor de referência).
3. **Ferramentas de flashcard** exigem que o aluno crie os cards manualmente — justamente o trabalho que ele não tem tempo de fazer na véspera da prova.
4. **Cursos e videoaulas** não se adaptam ao que o aluno já domina e não medem lacunas por tema.

### A oportunidade

Transformar **o material que o aluno já tem** em treino ativo, com rastreabilidade (de onde veio cada pergunta) e um ciclo fechado que devolve o erro como revisão. É exatamente o trabalho manual de montar um "caderno de questões" — automatizado e organizado.

---

## 2. Usuário e jobs-to-be-done

### Persona primária — "Ana, 4º ano, 3 semanas da prova"

- Estuda por capítulos e resumos, tem provas antigas no drive da turma.
- Sente que "lê muito e retém pouco".
- Quer saber **o que não sabe** antes da prova, não depois.
- Usa notebook e celular; estuda em intervalos de 20–50 minutos.

**Jobs to be done:**

| Quando… | Quero… | Para… |
| --- | --- | --- |
| Recebo o material da disciplina | transformá-lo em perguntas rapidamente | treinar sem montar questões à mão |
| Tenho 30 minutos livres | fazer um bloco curto e receber correção | sentir progresso real, não releitura |
| Erro uma questão | entender o erro e revê-lo no momento certo | não errar de novo na prova |
| A prova se aproxima | simular o formato e ver meu desempenho por área | priorizar o que estudar |

### Persona secundária — "Professor/monitor" (futuro)

Quer reaproveitar provas antigas e publicar casos para a turma. A v1 já permite publicar casos na comunidade e exportar/importar JSON, mas não tem gestão de turmas nem curadoria.

### Persona terciária — "Estudante de outra profissão" (roadmap)

Direito, enfermagem, engenharia: mesmo ciclo (material → casos → treino → revisão), com léxico e formato de caso próprios. Ver seção 10.

---

## 3. Princípios de produto

1. **O material do aluno é o ponto de partida.** Não exigimos que ele troque de fonte; a plataforma se adapta ao PDF que ele já tem.
2. **Fidelidade antes de criatividade.** Toda pergunta gerada sem IA é ancorada em um trecho literal. Com IA, o trecho-fonte é exibido para conferência. O aluno precisa poder confiar no que estuda.
3. **Um caminho, poucos cliques.** O fluxo ideal tem três decisões: enviar material → gerar casos → treinar. Nada de configurar taxonomias antes do primeiro valor.
4. **Erro é insumo, não vergonha.** A correção é imediata, explicada e vira revisão. O tom da interface evita punição e celebra constância.
5. **Funciona sem IA.** IA é acelerador, não dependência. Custo zero, privacidade melhor e disponibilidade garantida.
6. **Transparência radical.** A tela do material mostra o que a plataforma entendeu (seções, temas, questões, gabarito) e avisa quando não conseguiu ler. A prévia dos casos existe antes de gerar.

---

## 4. Jornada principal

```
Login/demo ─▶ Início ─▶ Materiais ─▶ [Upload] ─▶ Análise + prévia ─▶ Gerar casos
                                                                         │
                    ┌────────────────────────────────────────────────────┘
                    ▼
              Biblioteca ─▶ Treino (feedback) ─▶ Resumo ─▶ Revisão espaçada
                    │
                    └──▶ Simulado ─▶ Resultado por caso ─▶ Progresso
```

### Tela a tela

| Tela | Objetivo | Decisões de design |
| --- | --- | --- |
| **Login** | Entrar rápido | Conta demo em um clique; painel esquerdo explica o valor em 4 pontos. |
| **Início** | Responder "o que faço agora?" | Meta diária, sequência, cards vencidos e pontos frágeis em primeiro plano; onboarding de 3 passos quando a conta está vazia. |
| **Materiais** | Enviar e ver o que foi lido | Upload por arrastar ou colar texto; status visível (analisado/gerado/erro); temas detectados como badges. |
| **Detalhe do material** | Conferir a leitura e gerar | Estrutura do material, temas, condições, questões/gabarito, trechos extraídos e **prévia dos casos** antes de salvar. |
| **Biblioteca** | Escolher o próximo treino | Filtros por área/dificuldade/status, busca com debounce, "meus" vs. comunidade, ações contextuais (editar, publicar, duplicar, exportar). |
| **Treino** | Praticar com correção | Prontuário sempre acessível (recolhível), uma pergunta por vez, feedback com justificativa e trecho-fonte, atalhos 1–5 + Enter. |
| **Simulado** | Medir desempenho | Sem gabarito no percurso, tempo total, resultado por caso, erros enviados à revisão. |
| **Revisão** | Consolidar | Card com frente/verso, autopercepção (errei/difícil/bom/fácil), agenda de vencimento. |
| **Progresso** | Decidir o que estudar | Acerto por área e tema, pontos fortes/frágeis, constância, histórico e exportação. |
| **Configurações** | Ajustar rotina e IA | Meta diária, data da prova, revisão automática, provedor/modelo/chave com teste de conexão. |

### Heurísticas de usabilidade aplicadas

- **Prévia antes de gastar tempo**: o aluno vê as perguntas que serão geradas antes de criar os casos.
- **Sempre um próximo passo**: cada tela termina com uma ação primária (gerar, treinar, revisar, montar simulado).
- **Contexto clínico preservado**: no treino, o prontuário fica visível; o aluno não precisa decorar o enunciado.
- **Feedback específico**: além de "certo/errado", o app mostra a alternativa correta, a justificativa e o trecho original.
- **Estados vazios úteis**: cada tela vazia explica o que fazer e oferece o botão correspondente.

---

## 5. Modelo pedagógico

| Princípio | Como aparece no produto |
| --- | --- |
| **Aprendizagem baseada em casos (PBL)** | Casos com paciente, evolução e perguntas em progressão (apresentação → investigação → diagnóstico → conduta). |
| **Recuperação ativa (retrieval practice)** | Toda interação é uma pergunta com alternativas; nada de "marcar como lido". |
| **Prática distribuída / repetição espaçada** | Erros viram cards SM-2 com intervalos crescentes (1, 3, 4, 7, 15… dias). |
| **Intercalação (interleaving)** | Simulado mistura casos e áreas; a biblioteca permite treinar por tema, mas o simulado não agrupa. |
| **Feedback elaborado** | Justificativa explica por que a correta está certa e por que as outras não; o trecho-fonte ancora o conteúdo. |
| **Metacognição** | Autopercepção na revisão (errei/difícil/bom/fácil), desempenho por tema e pontos frágeis explícitos. |
| **Prática de exame** | Simulado com tempo, sem correção intermediária, resultado por caso. |

### Por que três formatos de treino (e não um só)

- **Caso clínico narrado** treina raciocínio e integração (o que a prova de residência cobra).
- **Bloco de fixação (cloze)** treina precisão conceitual e valores (o que a prova de faculdade cobra).
- **Questões de prova antiga** treinam o formato real da banca e são 100% fiéis à fonte.

O aluno escolhe o formato pelo tipo de material que tem. O produto não força um único modelo.

---

## 6. Funcionalidades e regras

### Materiais

- Entrada: PDF (com texto), DOCX, TXT, MD ou texto colado; até 25 MB / 600 mil caracteres.
- Extração de PDF reconstrói linhas por coordenada vertical, reduzindo quebra de frases.
- **Análise**: detecta tipo (prova/capítulo/resumo), títulos/seções, classificação das seções (definição, epidemiologia, fisiopatologia, quadro clínico, diagnóstico, tratamento, complicações, prevenção, questões, gabarito), temas do currículo, condições citadas, questões com alternativas e gabarito (inline ou seção "Gabarito").
- Avisos honestos: PDF sem texto, material curto, ausência de gabarito, ausência de títulos.
- Edição de título/disciplina, reanálise e exclusão (casos gerados são preservados, sem vínculo).

### Geração de casos

- **Modo estruturado** (sempre disponível):
  - Provas com gabarito → blocos de até 4 questões, preservando enunciado, alternativas e resposta.
  - Capítulos/resumos → perguntas de completar por seção, com alternativas do mesmo domínio e valores numéricos perturbados.
- **Modo IA** (opcional): casos completos, 3–4 perguntas em progressão, justificativas, `sourceExcerpt` quando fiel, validação e sanitização de tudo que a IA devolve.
- **Modo automático**: tenta IA; se falhar, cai para estruturado e informa o motivo.
- Geração é **idempotente por material**: regerar atualiza os casos existentes em vez de duplicar, preservando o histórico de respostas.
- Publicação opcional (rascunho por padrão no editor; publicado por padrão na geração, configurável).

### Treino e simulado

- Uma pergunta por vez, sem voltar (como na prova), com feedback imediato no treino.
- Simulado: sem feedback até o fim, resultado por caso, encerramento antecipado permitido.
- Erros geram cards de revisão automaticamente (configurável).
- Histórico guarda um **snapshot** de cada resposta (enunciado, alternativa correta, justificativa), então editar ou excluir o caso não apaga o histórico.

### Progresso

- Acerto por área e tema (mínimo de 2 respostas para entrar nas listas).
- Pontos frágeis: < 75% de acerto; pontos fortes: ≥ 75%.
- Sequência de dias com estudo; meta diária configurável.
- Exportação CSV com uma linha por resposta.

---

## 7. Fidelidade do conteúdo: quando usar cada modo

| Critério | Estruturado (sem IA) | IA |
| --- | --- | --- |
| Fidelidade ao texto | Literal | Alta, mas sujeita a erro — revisar |
| Caso clínico narrativo | Não (só bloco de fixação) | Sim |
| Progressão clínica | Limitada | Sim (apresentação → conduta) |
| Custo | Zero | Depende do provedor |
| Privacidade | Totalmente local | Envia o texto ao provedor |
| Melhor para | Provas antigas com gabarito, resumo com subtítulos | Capítulo denso, tema sem questões |
| Risco principal | Perguntas de "completar" menos desafiadoras | Alucinação de dose/valor |

**Decisão de produto:** o modo estruturado é o padrão quando não há IA configurada, e a interface explica a diferença antes de gerar. Nenhum caso gerado é apresentado como verdade absoluta: a justificativa mostra o trecho-fonte e o aluno pode editar antes de publicar.

---

## 8. Métricas de sucesso

### Produto (o que mediria no mundo real)

| Métrica | Definição | Alvo inicial |
| --- | --- | --- |
| **Ativação** | % de contas que geram ≥ 1 caso em 24h após o cadastro | > 60% |
| **Primeiro valor** | Tempo entre upload e primeiro caso gerado | < 2 min |
| **Engajamento semanal** | Sessões de treino por usuário ativo | ≥ 3 |
| **Retenção D7 / D30** | Volta na semana / no mês seguinte | 45% / 25% |
| **Conclusão de simulado** | % de simulados iniciados que terminam | > 70% |
| **Adesão à revisão** | Cards revisados no dia do vencimento | > 50% |
| **Qualidade percebida** | % de casos gerados mantidos (não excluídos/editados em 7 dias) | > 75% |
| **Evolução de acerto** | Delta de acerto entre 1ª e 3ª tentativa no mesmo tema | +15 p.p. |

### Saúde técnica

- Taxa de falha de extração por tipo de arquivo.
- Taxa de casos gerados com < 2 perguntas (sinal de material ruim).
- Taxa de erro do provedor de IA e latência p95.
- Cobertura de gabarito encontrado em provas antigas.

---

## 9. Roadmap sugerido

### Fase 1 — agora (entregue nesta versão)

Núcleo do ciclo: materiais → geração estruturada/IA → treino → simulado → revisão → progresso; conta demo; editor manual; exportação.

### Fase 2 — próximas 6 a 10 semanas

| Prioridade | Item | Por quê |
| --- | --- | --- |
| P0 | **OCR para PDF escaneado** (Tesseract local ou serviço) | Grande parte das provas antigas circula como foto/scan. |
| P0 | **Curadoria/revisão de casos** (fila de revisão, relato de erro) | Qualidade é o principal risco percebido. |
| P1 | **Turmas e compartilhamento** (professor publica, aluno consome) | Canal de aquisição e uso institucional. |
| P1 | **Busca por tema dentro do material** (âncoras por página) | Aumenta confiança na fonte e facilita conferência. |
| P1 | **Modo offline/PWA** e notificações de revisão | Revisão falha sem lembrete. |
| P2 | **Importação de bancos de questões** (CSV/JSON) | Aproveita conteúdo já digitalizado. |
| P2 | **Explicação adaptativa** ("por que errei") com IA | Personaliza o feedback. |

### Fase 3 — 3 a 6 meses

- **Plano de estudo adaptativo**: dado data da prova + desempenho, distribuir temas no calendário.
- **Simulado com blueprint** (pesos por área, estilo de banca).
- **Colaboração**: casos comentados, ranking opcional por turma.
- **Analytics para professor**: mapa de dificuldade da turma.
- **App mobile** (React Native) com foco em revisão e treino curto.

---

## 10. Expansão para outras profissões

O produto é, no fundo, um **pipeline de conteúdo → prática → retenção**. O que é específico de medicina hoje:

| Componente específico | Onde está | Como generalizar |
| --- | --- | --- |
| Léxico de áreas/temas e condições | `server/ingestion/lexicon.ts` | Trocar por "domínios" e "tópicos" por profissão (ex.: Direito → Civil, Penal, Processo). |
| Formato de caso clínico (`presentation`) | `shared/types.ts` | Criar formato de "enunciado" configurável (fato, contexto, partes, anexos). |
| Banco de termos para alternativas | `server/generation/cloze.ts` | Banco de termos por domínio (normas, institutos, autores, prazos, fórmulas). |
| Prompt de IA | `server/generation/llm.ts` | Prompt base por profissão + exemplos (few-shot). |
| Revisão espaçada, simulado, progresso | Núcleo | Reutilização direta. |

### Abstração mínima recomendada

Introduzir um conceito de **Perfil de Domínio** (arquivo de configuração) contendo:

```ts
interface DomainProfile {
  id: 'medicina' | 'direito' | 'enfermagem' | string;
  name: string;
  areas: string[];
  caseFormat: 'clinical' | 'legal' | 'technical';
  termBank: Record<string, string[]>;
  prompt: { system: string; schema: object };
  lexicon: TopicEntry[];
}
```

Com isso, o mesmo motor gera casos de outra profissão sem tocar no núcleo. A interface troca apenas o vocabulário ("paciente" → "situação", "exame" → "documento").

### Sequência recomendada de expansão

1. **Enfermagem** (maior proximidade de formato e conteúdo; mesma lógica de caso).
2. **Direito** (caso com partes e decisão; forte demanda de OAB/concurso).
3. **Engenharias e exatas** (formato de problema com cálculo; exige suporte a fórmulas e imagens).
4. **Concursos públicos em geral** (formato de questão objetiva; reaproveita quase tudo do modo "prova antiga").

---

## 11. Riscos e mitigação

| Risco | Impacto | Mitigação implementada / planejada |
| --- | --- | --- |
| **Alucinação da IA** (dose, valor, conduta) | Alto (risco pedagógico e de segurança) | Prompt restritivo, justificativa com trecho-fonte, prévia antes de publicar, modo estruturado fiel como alternativa, aviso explícito no caso. |
| **PDF ilegível (scan)** | Alto | Detecção e aviso claro; OCR no roadmap. |
| **Material protegido por direitos autorais** | Médio/alto | Uso pessoal por padrão (rascunho); publicação exige ação explícita; aviso nas configurações; roadmap: checagem e política de uso. |
| **Sobrecarga de casos gerados** | Médio | Limite por geração, agrupamento por blocos, filtros. |
| **Qualidade do gabarito de provas antigas** | Médio | Só reutiliza questões com gabarito explícito; mostra a origem. |
| **Privacidade** | Alto | Sem envio externo por padrão; chave criptografada; dados locais; exportação. |
| **Complexidade de configuração de IA** | Médio | Provedores pré-configurados, teste de conexão, listagem de modelos, fallback automático. |
| **Dependência de um único processo Node** | Baixo nesta fase | Próximo passo: fila de processamento e storage de arquivos. |

---

## 12. O que ficou de fora de propósito (e por quê)

- **OCR**: exige binário/serviço externo; melhor entrar com avaliação de qualidade.
- **Colaboração em tempo real e chat**: não é o gargalo do aprendizado; adiciona complexidade.
- **Gamificação pesada** (ranking, badges): pode desviar do objetivo em um público já ansioso por provas; a sequência e a meta diária cobrem o reforço sem pressão.
- **Mobile nativo**: a interface é responsiva; validar uso real antes de investir em app.
- **Editor de imagens médicas**: imagens entram como laudo textual nesta versão.

---

## Resumo em uma frase

**Study Flux transforma o material que o aluno já tem em prática ativa com rastreabilidade e devolve cada erro como revisão — sem exigir que ele abandone suas fontes nem que saiba montar questões.**
