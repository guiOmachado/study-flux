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
    keywords: ['hipertensao arterial', 'hipertensao', 'pressao arterial', 'has', 'anti-hipertensivo', 'anti-hipertensivos', 'hypertension', 'arterial hypertension', 'blood pressure', 'antihypertensive', 'antihypertensives'],
    conditions: ['hipertensão arterial sistêmica', 'hipertensão', 'crise hipertensiva', 'emergência hipertensiva', 'systemic arterial hypertension', 'hypertensive crisis', 'hypertensive emergency'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Diabetes mellitus',
    keywords: ['diabetes mellitus', 'diabetes', 'glicemia', 'hemoglobina glicada', 'hba1c', 'insulina', 'metformina', 'diabetes mellitus', 'diabetes', 'glycemia', 'glycated hemoglobin', 'hba1c', 'insulin', 'metformin', 'blood glucose'],
    conditions: ['diabetes mellitus tipo 2', 'diabetes mellitus tipo 1', 'cetoacidose diabética', 'hipoglicemia', 'type 2 diabetes mellitus', 'type 1 diabetes mellitus', 'diabetic ketoacidosis', 'hypoglycemia'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Insuficiência cardíaca',
    keywords: ['insuficiencia cardiaca', 'icc', 'fracao de ejecao', 'dispneia paroxistica', 'edema agudo de pulmao', 'heart failure', 'ejection fraction', 'paroxysmal dyspnea', 'acute pulmonary edema'],
    conditions: ['insuficiência cardíaca', 'edema agudo de pulmão', 'insuficiência cardíaca congestiva', 'heart failure', 'acute pulmonary edema', 'congestive heart failure'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Síndromes coronarianas agudas',
    keywords: ['sindrome coronariana', 'infarto agudo do miocardio', 'iam', 'angina', 'troponina', 'supradesnivelamento', 'coronary syndrome', 'myocardial infarction', 'angina', 'troponin', 'st-segment elevation', 'st elevation'],
    conditions: ['infarto agudo do miocárdio', 'angina instável', 'síndrome coronariana aguda', 'acute myocardial infarction', 'unstable angina', 'acute coronary syndrome'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Pneumonia',
    keywords: ['pneumonia', 'consolidacao pulmonar', 'curb-65', 'escarro', 'antibioticoterapia', 'pneumonia', 'pulmonary consolidation', 'curb-65', 'sputum', 'antibiotic therapy'],
    conditions: ['pneumonia comunitária', 'pneumonia hospitalar', 'derrame pleural parapneumônico', 'community-acquired pneumonia', 'hospital-acquired pneumonia', 'parapneumonic effusion'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Asma e DPOC',
    keywords: ['asma', 'dpoc', 'doenca pulmonar obstrutiva', 'broncoespasmo', 'espirometria', 'vef1', 'asthma', 'copd', 'chronic obstructive pulmonary disease', 'bronchospasm', 'spirometry', 'fev1'],
    conditions: ['asma', 'exacerbação de asma', 'doença pulmonar obstrutiva crônica', 'exacerbação de DPOC', 'asthma', 'asthma exacerbation', 'chronic obstructive pulmonary disease', 'copd exacerbation'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Sepse e infecções graves',
    keywords: ['sepse', 'choque septico', 'sofa', 'qsofa', 'lactato', 'hemocultura', 'sepsis', 'septic shock', 'sofa', 'qsofa', 'lactate', 'blood culture', 'blood cultures', 'organ dysfunction'],
    conditions: ['sepse', 'choque séptico', 'disfunção orgânica', 'sepsis', 'septic shock', 'organ dysfunction'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Doença renal crônica',
    keywords: ['doenca renal cronica', 'drc', 'creatinina', 'taxa de filtracao glomerular', 'dialise', 'proteinuria', 'chronic kidney disease', 'ckd', 'creatinine', 'glomerular filtration rate', 'dialysis', 'proteinuria', 'acute kidney injury'],
    conditions: ['doença renal crônica', 'lesão renal aguda', 'síndrome nefrótica', 'chronic kidney disease', 'acute kidney injury', 'nephrotic syndrome'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Doenças hepáticas',
    keywords: ['cirrose', 'hepatite', 'ascite', 'encefalopatia hepatica', 'bilirrubina', 'transaminases', 'cirrhosis', 'hepatitis', 'ascites', 'hepatic encephalopathy', 'bilirubin', 'transaminases'],
    conditions: ['cirrose hepática', 'hepatite viral', 'encefalopatia hepática', 'liver cirrhosis', 'viral hepatitis', 'hepatic encephalopathy'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Acidente vascular cerebral',
    keywords: ['acidente vascular cerebral', 'avc', 'isquemia cerebral', 'trombólise', 'nihss', 'hemiplegia', 'stroke', 'cerebral ischemia', 'thrombolysis', 'nihss', 'hemiplegia', 'cerebral infarction'],
    conditions: ['acidente vascular cerebral isquêmico', 'acidente vascular cerebral hemorrágico', 'ischemic stroke', 'hemorrhagic stroke', 'cerebral infarction'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Tireoide',
    keywords: ['hipotireoidismo', 'hipertireoidismo', 'tireoide', 'tsh', 't4 livre', 'bocio', 'hypothyroidism', 'hyperthyroidism', 'thyroid', 'tsh', 'free t4', 'goiter', 'thyrotoxicosis'],
    conditions: ['hipotireoidismo', 'hipertireoidismo', 'tireotoxicose', 'hypothyroidism', 'hyperthyroidism', 'thyrotoxicosis'],
  },
  {
    area: 'Clínica Médica',
    topic: 'Anemia',
    keywords: ['anemia', 'hemoglobina', 'ferritina', 'ferropriva', 'hematocrito', 'reticulocitos', 'anemia', 'haemoglobin', 'hemoglobin', 'ferritin', 'iron deficiency', 'hematocrit', 'reticulocyte'],
    conditions: ['anemia ferropriva', 'anemia megaloblástica', 'anemia hemolítica', 'iron deficiency anemia', 'megaloblastic anemia', 'hemolytic anemia'],
  },
  {
    area: 'Cirurgia',
    topic: 'Abdome agudo',
    keywords: ['abdome agudo', 'apendicite', 'colecistite', 'peritonite', 'dor abdominal', 'defesa abdominal', 'acute abdomen', 'appendicitis', 'cholecystitis', 'peritonitis', 'abdominal pain', 'abdominal guarding'],
    conditions: ['apendicite aguda', 'colecistite aguda', 'peritonite', 'obstrução intestinal', 'acute appendicitis', 'acute cholecystitis', 'peritonitis', 'bowel obstruction', 'intestinal obstruction'],
  },
  {
    area: 'Cirurgia',
    topic: 'Trauma',
    keywords: ['trauma', 'atls', 'abcde', 'hemorragia', 'politraumatizado', 'ferimento', 'trauma', 'atls', 'abcde', 'hemorrhage', 'haemorrhage', 'polytrauma', 'wound'],
    conditions: ['politraumatismo', 'trauma abdominal', 'trauma cranioencefálico', 'choque hemorrágico', 'polytrauma', 'abdominal trauma', 'traumatic brain injury', 'hemorrhagic shock'],
  },
  {
    area: 'Cirurgia',
    topic: 'Pré e pós-operatório',
    keywords: ['pre-operatorio', 'pos-operatorio', 'anestesia', 'deiscencia', 'profilaxia', 'risco cirurgico', 'preoperative', 'postoperative', 'anesthesia', 'anaesthesia', 'dehiscence', 'prophylaxis', 'surgical risk'],
    conditions: ['complicações pós-operatórias', 'infecção de sítio cirúrgico', 'postoperative complications', 'surgical site infection'],
  },
  {
    area: 'Cirurgia',
    topic: 'Hérnias',
    keywords: ['hernia', 'inguinal', 'encarceramento', 'estrangulamento', 'hernia', 'inguinal', 'incarceration', 'strangulation'],
    conditions: ['hérnia inguinal', 'hérnia encarcerada', 'hérnia umbilical', 'inguinal hernia', 'incarcerated hernia', 'umbilical hernia'],
  },
  {
    area: 'Pediatria',
    topic: 'Crescimento e desenvolvimento',
    keywords: ['puericultura', 'crescimento', 'desenvolvimento', 'curva de crescimento', 'aleitamento', 'growth', 'development', 'growth chart', 'breastfeeding', 'child development', 'puericulture'],
    conditions: ['baixa estatura', 'desnutrição infantil', 'atraso do desenvolvimento', 'short stature', 'child malnutrition', 'developmental delay'],
  },
  {
    area: 'Pediatria',
    topic: 'Doenças respiratórias na infância',
    keywords: ['bronquiolite', 'crup', 'sibilancia', 'crianca', 'lactente', 'pediatria', 'bronchiolitis', 'croup', 'wheezing', 'infant', 'pediatric', 'paediatric'],
    conditions: ['bronquiolite viral aguda', 'crup', 'pneumonia infantil', 'acute viral bronchiolitis', 'croup', 'pediatric pneumonia', 'childhood pneumonia'],
  },
  {
    area: 'Pediatria',
    topic: 'Desidratação e distúrbios hidroeletrolíticos',
    keywords: ['desidratacao', 'plano a', 'plano b', 'plano c', 'sais de reidratacao', 'solucao de manutencao', 'dehydration', 'oral rehydration', 'rehydration solution', 'maintenance fluids', 'electrolyte'],
    conditions: ['desidratação', 'diarreia aguda', 'distúrbio hidroeletrolítico', 'dehydration', 'acute diarrhea', 'electrolyte disorder', 'electrolyte disturbance'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Pré-natal',
    keywords: ['pre-natal', 'gestacao', 'gestante', 'prenatal', 'consultas de pre-natal', 'acido folico', 'prenatal care', 'antenatal care', 'pregnancy', 'pregnant', 'folic acid', 'gestation'],
    conditions: ['gestação de risco habitual', 'pré-natal de baixo risco', 'uncomplicated pregnancy', 'low-risk prenatal care'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Síndromes hipertensivas da gestação',
    keywords: ['pre-eclampsia', 'eclampsia', 'hellp', 'sindrome hipertensiva', 'proteinuria na gestacao', 'preeclampsia', 'pre-eclampsia', 'eclampsia', 'hellp', 'gestational hypertension', 'proteinuria in pregnancy'],
    conditions: ['pré-eclâmpsia', 'eclâmpsia', 'síndrome HELLP', 'preeclampsia', 'preeclampsia with severe features', 'eclampsia', 'hellp syndrome'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Diabetes gestacional',
    keywords: ['diabetes gestacional', 'gtt', 'tolerancia a glicose', 'gestante diabetica', 'gestational diabetes', 'oral glucose tolerance test', 'ogtt'],
    conditions: ['diabetes gestacional', 'gestational diabetes mellitus', 'gestational diabetes'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Trabalho de parto',
    keywords: ['trabalho de parto', 'partograma', 'dilatacao', 'periodo expulsivo', 'cesarea', 'indução do parto', 'labor', 'labour', 'partogram', 'cervical dilation', 'cesarean', 'caesarean', 'induction of labor'],
    conditions: ['trabalho de parto', 'parto prematuro', 'distocia', 'labor', 'preterm labor', 'dystocia'],
  },
  {
    area: 'Ginecologia e Obstetrícia',
    topic: 'Sangramento genital',
    keywords: ['sangramento uterino', 'menorragia', 'amenorreia', 'hemorragia pos-parto', 'sangramento genital', 'uterine bleeding', 'menorrhagia', 'amenorrhea', 'postpartum hemorrhage', 'vaginal bleeding'],
    conditions: ['sangramento uterino anormal', 'hemorragia pós-parto', 'abnormal uterine bleeding', 'postpartum hemorrhage'],
  },
  {
    area: 'Saúde Coletiva',
    topic: 'SUS e organização da atenção',
    keywords: ['sus', 'sistema unico de saude', 'atencao primaria', 'estrategia saude da familia', 'rede de atencao', 'unified health system', 'primary care', 'family health strategy', 'health system'],
    conditions: ['princípios do SUS', 'atenção primária à saúde', 'principles of the brazilian unified health system', 'primary health care'],
  },
  {
    area: 'Saúde Coletiva',
    topic: 'Epidemiologia e prevenção',
    keywords: ['epidemiologia', 'incidencia', 'prevalencia', 'sensibilidade', 'especificidade', 'rastreamento', 'vacinacao', 'epidemiology', 'incidence', 'prevalence', 'sensitivity', 'specificity', 'screening', 'vaccination', 'immunization'],
    conditions: ['rastreamento', 'surto epidêmico', 'cobertura vacinal', 'screening', 'outbreak', 'vaccination coverage'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Transtornos do humor',
    keywords: ['depressao', 'transtorno depressivo', 'humor', 'suicidio', 'transtorno bipolar', 'depression', 'depressive disorder', 'mood', 'suicide', 'bipolar disorder', 'major depressive'],
    conditions: ['depressão maior', 'transtorno bipolar', 'risco de suicídio', 'major depression', 'major depressive disorder', 'bipolar disorder', 'suicide risk'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Transtornos de ansiedade',
    keywords: ['ansiedade', 'panico', 'transtorno de ansiedade', 'fobia', 'anxiety', 'panic', 'anxiety disorder', 'phobia', 'generalized anxiety'],
    conditions: ['transtorno de ansiedade generalizada', 'transtorno do pânico', 'generalized anxiety disorder', 'panic disorder'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Esquizofrenia e psicoses',
    keywords: ['esquizofrenia', 'psicose', 'delirio', 'alucinacao', 'antipsicotico', 'schizophrenia', 'psychosis', 'delusion', 'hallucination', 'antipsychotic'],
    conditions: ['esquizofrenia', 'primeiro episódio psicótico', 'schizophrenia', 'first-episode psychosis'],
  },
  {
    area: 'Psiquiatria',
    topic: 'Uso de substâncias',
    keywords: ['alcoolismo', 'dependencia quimica', 'abstinencia', 'intoxicacao', 'tabagismo', 'alcoholism', 'substance use', 'withdrawal', 'intoxication', 'smoking', 'alcohol dependence', 'tobacco'],
    conditions: ['dependência de álcool', 'síndrome de abstinência', 'tabagismo', 'alcohol dependence', 'substance withdrawal', 'smoking', 'tobacco use disorder'],
  },
];

export const SECTION_TYPES: { type: string; keywords: string[] }[] = [
  { type: 'definicao', keywords: ['definicao', 'conceito', 'introducao', 'visao geral', 'resumo', 'definition', 'concept', 'overview', 'summary', 'background'] },
  { type: 'epidemiologia', keywords: ['epidemiologia', 'incidencia', 'prevalencia', 'fatores de risco', 'epidemiology', 'incidence', 'prevalence', 'risk factors'] },
  { type: 'fisiopatologia', keywords: ['fisiopatologia', 'etiopatogenia', 'mecanismo', 'etiologia', 'pathophysiology', 'etiology', 'aetiology', 'mechanism', 'pathogenesis'] },
  { type: 'quadro_clinico', keywords: ['quadro clinico', 'manifestacoes', 'sintomas', 'apresentacao clinica', 'sinais e sintomas', 'clinica', 'clinical presentation', 'clinical features', 'symptoms', 'signs and symptoms', 'manifestations', 'clinical picture'] },
  { type: 'diagnostico', keywords: ['diagnostico', 'investigacao', 'exames', 'criterios', 'avaliacao', 'diagnosis', 'diagnostic', 'investigation', 'workup', 'criteria', 'assessment', 'evaluation'] },
  { type: 'tratamento', keywords: ['tratamento', 'conduta', 'manejo', 'terapeutica', 'farmacoterapia', 'cuidados', 'treatment', 'management', 'therapy', 'pharmacotherapy', 'care', 'therapeutic'] },
  { type: 'complicacoes', keywords: ['complicacoes', 'prognostico', 'evolucao', 'seguimento', 'complications', 'prognosis', 'outcome', 'follow-up', 'follow up'] },
  { type: 'prevencao', keywords: ['prevencao', 'profilaxia', 'rastreamento', 'imunizacao', 'prevention', 'prophylaxis', 'screening', 'immunization', 'vaccination'] },
  { type: 'caso', keywords: ['caso clinico', 'relato de caso', 'case report', 'clinical case'] },
  { type: 'questoes', keywords: ['questoes', 'exercicios', 'atividades', 'teste', 'simulado', 'perguntas', 'questions', 'exercises', 'quiz', 'self-assessment', 'practice questions'] },
  { type: 'gabarito', keywords: ['gabarito', 'respostas', 'resposta', 'comentarios', 'answer key', 'answers', 'correct answers', 'rationale'] },
  { type: 'referencias', keywords: ['referencias', 'bibliografia', 'leitura recomendada', 'references', 'bibliography', 'further reading', 'suggested reading'] },
];

export const AREA_KEYWORDS: { area: string; keywords: string[] }[] = [
  { area: 'Pediatria', keywords: ['crianca', 'lactente', 'neonato', 'pediatrico', 'puericultura', 'rn', 'infant', 'child', 'children', 'pediatric', 'paediatric', 'neonate', 'newborn', 'toddler'] },
  { area: 'Ginecologia e Obstetrícia', keywords: ['gestante', 'gestacao', 'parto', 'puerperio', 'obstetricia', 'ginecologia', 'pregnancy', 'pregnant', 'labor', 'labour', 'postpartum', 'obstetrics', 'gynecology', 'gynaecology', 'cesarean', 'antenatal'] },
  { area: 'Cirurgia', keywords: ['cirurgia', 'cirurgico', 'operatorio', 'anestesia', 'trauma', 'surgery', 'surgical', 'operative', 'anesthesia', 'anaesthesia', 'trauma', 'postoperative'] },
  { area: 'Saúde Coletiva', keywords: ['sus', 'epidemiologia', 'saude publica', 'atencao primaria', 'vacinacao', 'public health', 'epidemiology', 'primary care', 'health system', 'vaccination', 'screening'] },
  { area: 'Psiquiatria', keywords: ['psiquiatria', 'depressao', 'ansiedade', 'psicose', 'psicofarmaco', 'psychiatry', 'depression', 'anxiety', 'psychosis', 'antipsychotic', 'mental health'] },
  { area: 'Clínica Médica', keywords: ['clinica medica', 'hipertensao', 'diabetes', 'pneumonia', 'cardio', 'nefro', 'internal medicine', 'cardiology', 'nephrology', 'hepatology', 'endocrinology', 'neurology'] },
];
