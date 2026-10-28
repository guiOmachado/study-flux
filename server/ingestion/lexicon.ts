// Léxico curricular mínimo (PT-BR) usado para classificar materiais e casos.
// É extensível: basta adicionar novos temas/termos.
export interface TopicEntry {
  area: string;
  topic: string;
  keywords: string[];
  conditions: string[];
}

export const TOPIC_LEXICON: TopicEntry[] = [
  {
    area: 'Clínica Médica',
    topic: 'Hipertensão arterial sistêmica',
    keywords: ['hipertensao arterial', 'hipertensao', 'pressao arterial', 'has', 'anti-hipertensivo', 'anti-hipertensivos'],
    conditions: ['hipertensão arterial sistêmica', 'hipertensão', 'crise hipertensiva', 'emergência hipertensiva'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Diabetes mellitus',
    keywords: ['diabetes mellitus', 'diabetes', 'glicemia', 'hemoglobina glicada', 'hba1c', 'insulina', 'metformina'],
    conditions: ['diabetes mellitus tipo 2', 'diabetes mellitus tipo 1', 'cetoacidose diabética', 'hipoglicemia'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Insuficiência cardíaca',
    keywords: ['insuficiencia cardiaca', 'icc', 'fracao de ejecao', 'dispneia paroxistica', 'edema agudo de pulmao'],
    conditions: ['insuficiência cardíaca', 'edema agudo de pulmão', 'insuficiência cardíaca congestiva'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Síndromes coronarianas agudas',
    keywords: ['sindrome coronariana', 'infarto agudo do miocardio', 'iam', 'angina', 'troponina', 'supradesnivelamento'],
    conditions: ['infarto agudo do miocárdio', 'angina instável', 'síndrome coronariana aguda'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Pneumonia',
    keywords: ['pneumonia', 'consolidacao pulmonar', 'curb-65', 'escarro', 'antibioticoterapia'],
    conditions: ['pneumonia comunitária', 'pneumonia hospitalar', 'derrame pleural parapneumônico'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Asma e DPOC',
    keywords: ['asma', 'dpoc', 'doenca pulmonar obstrutiva', 'broncoespasmo', 'espirometria', 'vef1'],
    conditions: ['asma', 'exacerbação de asma', 'doença pulmonar obstrutiva crônica', 'exacerbação de DPOC'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Sepse e infecções graves',
    keywords: ['sepse', 'choque septico', 'sofa', 'qsofa', 'lactato', 'hemocultura'],
    conditions: ['sepse', 'choque séptico', 'disfunção orgânica'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Doença renal crônica',
    keywords: ['doenca renal cronica', 'drc', 'creatinina', 'taxa de filtracao glomerular', 'dialise', 'proteinuria'],
    conditions: ['doença renal crônica', 'lesão renal aguda', 'síndrome nefrótica'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Doenças hepáticas',
    keywords: ['cirrose', 'hepatite', 'ascite', 'encefalopatia hepatica', 'bilirrubina', 'transaminases'],
    conditions: ['cirrose hepática', 'hepatite viral', 'encefalopatia hepática'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Acidente vascular cerebral',
    keywords: ['acidente vascular cerebral', 'avc', 'isquemia cerebral', 'trombólise', 'nihss', 'hemiplegia'],
    conditions: ['acidente vascular cerebral isquêmico', 'acidente vascular cerebral hemorrágico'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Tireoide',
    keywords: ['hipotireoidismo', 'hipertireoidismo', 'tireoide', 'tsh', 't4 livre', 'bocio'],
    conditions: ['hipotireoidismo', 'hipertireoidismo', 'tireotoxicose'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Anemia',
    keywords: ['anemia', 'hemoglobina', 'ferritina', 'ferropriva', 'hematocrito', 'reticulocitos'],
    conditions: ['anemia ferropriva', 'anemia megaloblástica', 'anemia hemolítica'],
  },
  {
    area: 'Cirurgia',
    topic: 'Abdome agudo',
    keywords: ['abdome agudo', 'apendicite', 'colecistite', 'peritonite', 'dor abdominal', 'defesa abdominal'],
    conditions: ['apendicite aguda', 'colecistite aguda', 'peritonite', 'obstrução intestinal'],
  },
  {
    area: 'Cirurgia',
    topic: 'Trauma',
    keywords: ['trauma', 'atls', 'abcde', 'hemorragia', 'politraumatizado', 'ferimento'],
    conditions: ['politraumatismo', 'trauma abdominal', 'trauma cranioencefálico', 'choque hemorrágico'],
  },
  {
    area: 'Cirurgia',
    topic: 'Pré e pós-operatório',
    keywords: ['pre-operatorio', 'pos-operatorio', 'anestesia', 'deiscencia', 'profilaxia', 'risco cirurgico'],
    conditions: ['complicações pós-operatórias', 'infecção de sítio cirúrgico'],
  },
  {
    area: 'Cirurgia',
    topic: 'Hérnias',
    keywords: ['hernia', 'inguinal', 'encarceramento', 'estrangulamento'],
    conditions: ['hérnia inguinal', 'hérnia encarcerada', 'hérnia umbilical'],
  },
  {
    area: 'Pediatria',
    topic: 'Crescimento e desenvolvimento',
    keywords: ['puericultura', 'crescimento', 'desenvolvimento', 'curva de crescimento', 'aleitamento'],
    conditions: ['baixa estatura', 'desnutrição infantil', 'atraso do desenvolvimento'],
  },
  {
    area: 'Pediatria',
    topic: 'Doenças respiratórias na infância',
    keywords: ['bronquiolite', 'crup', 'sibilancia', 'crianca', 'lactente', 'pediatria'],
    conditions: ['bronquiolite viral aguda', 'crup', 'pneumonia infantil'],
  },
  {
    area: 'Pediatria',
    topic: 'Desidratação e distúrbios hidroeletrolíticos',
    keywords: ['desidratacao', 'plano a', 'plano b', 'plano c', 'sais de reidratacao', 'solucao de manutencao'],
    conditions: ['desidratação', 'diarreia aguda', 'distúrbio hidroeletrolítico'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Pré-natal',
    keywords: ['pre-natal', 'gestacao', 'gestante', 'prenatal', 'consultas de pre-natal', 'acido folico'],
    conditions: ['gestação de risco habitual', 'pré-natal de baixo risco'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Síndromes hipertensivas da gestação',
    keywords: ['pre-eclampsia', 'eclampsia', 'hellp', 'sindrome hipertensiva', 'proteinuria na gestacao'],
    conditions: ['pré-eclâmpsia', 'eclâmpsia', 'síndrome HELLP'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Diabetes gestacional',
    keywords: ['diabetes gestacional', 'gtt', 'tolerancia a glicose', 'gestante diabetica'],
    conditions: ['diabetes gestacional'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Trabalho de parto',
    keywords: ['trabalho de parto', 'partograma', 'dilatacao', 'periodo expulsivo', 'cesarea', 'indução do parto'],
    conditions: ['trabalho de parto', 'parto prematuro', 'distocia'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Sangramento genital',
    keywords: ['sangramento uterino', 'menorragia', 'amenorreia', 'hemorragia pos-parto', 'sangramento genital'],
    conditions: ['sangramento uterino anormal', 'hemorragia pós-parto'],
  },
  {
    area: 'Saúde Coletiva',
    topic: 'SUS e organização da atenção',
    keywords: ['sus', 'sistema unico de saude', 'atencao primaria', 'estrategia saude da familia', 'rede de atencao'],
    conditions: ['princípios do SUS', 'atenção primária à saúde'],
  },
  {
    area: 'Saúde Coletiva',
    topic: 'Epidemiologia e prevenção',
    keywords: ['epidemiologia', 'incidencia', 'prevalencia', 'sensibilidade', 'especificidade', 'rastreamento', 'vacinacao'],
    conditions: ['rastreamento', 'surto epidêmico', 'cobertura vacinal'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Transtornos do humor',
    keywords: ['depressao', 'transtorno depressivo', 'humor', 'suicidio', 'transtorno bipolar'],
    conditions: ['depressão maior', 'transtorno bipolar', 'risco de suicídio'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Transtornos de ansiedade',
    keywords: ['ansiedade', 'panico', 'transtorno de ansiedade', 'fobia'],
    conditions: ['transtorno de ansiedade generalizada', 'transtorno do pânico'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Esquizofrenia e psicoses',
    keywords: ['esquizofrenia', 'psicose', 'delirio', 'alucinacao', 'antipsicotico'],
    conditions: ['esquizofrenia', 'primeiro episódio psicótico'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Uso de substâncias',
    keywords: ['alcoolismo', 'dependencia quimica', 'abstinencia', 'intoxicacao', 'tabagismo'],
    conditions: ['dependência de álcool', 'síndrome de abstinência', 'tabagismo'],
  },
];

export const SECTION_TYPES: { type: string; keywords: string[] }[] = [
  { type: 'definicao', keywords: ['definicao', 'conceito', 'introducao', 'visao geral', 'resumo'] },
  { type: 'epidemiologia', keywords: ['epidemiologia', 'incidencia', 'prevalencia', 'fatores de risco'] },
  { type: 'fisiopatologia', keywords: ['fisiopatologia', 'etiopatogenia', 'mecanismo', 'etiologia'] },
  { type: 'quadro_clinico', keywords: ['quadro clinico', 'manifestacoes', 'sintomas', 'apresentacao clinica', 'sinais e sintomas', 'clinica'] },
  { type: 'diagnostico', keywords: ['diagnostico', 'investigacao', 'exames', 'criterios', 'avaliacao'] },
  { type: 'tratamento', keywords: ['tratamento', 'conduta', 'manejo', 'terapeutica', 'farmacoterapia', 'cuidados'] },
  { type: 'complicacoes', keywords: ['complicacoes', 'prognostico', 'evolucao', 'seguimento'] },
  { type: 'prevencao', keywords: ['prevencao', 'profilaxia', 'rastreamento', 'imunizacao'] },
  { type: 'caso', keywords: ['caso clinico', 'relato de caso'] },
  { type: 'questoes', keywords: ['questoes', 'exercicios', 'atividades', 'teste', 'simulado', 'perguntas'] },
  { type: 'gabarito', keywords: ['gabarito', 'respostas', 'resposta', 'comentarios'] },
  { type: 'referencias', keywords: ['referencias', 'bibliografia', 'leitura recomendada'] },
];

export const AREA_KEYWORDS: { area: string; keywords: string[] }[] = [
  { area: 'Pediatria', keywords: ['crianca', 'lactente', 'neonato', 'pediatrico', 'puericultura', 'rn'] },
  { area: 'Ginecologia e Obstetrícia', keywords: ['gestante', 'gestacao', 'parto', 'puerperio', 'obstetricia', 'ginecologia'] },
  { area: 'Cirurgia', keywords: ['cirurgia', 'cirurgico', 'operatorio', 'anestesia', 'trauma'] },
  { area: 'Saúde Coletiva', keywords: ['sus', 'epidemiologia', 'saude publica', 'atencao primaria', 'vacinacao'] },
  { area: 'Psiquiatria', keywords: ['psiquiatria', 'depressao', 'ansiedade', 'psicose', 'psicofarmaco'] },
  { area: 'Clínica Médica', keywords: ['clinica medica', 'hipertensao', 'diabetes', 'pneumonia', 'cardio', 'nefro'] },
];
