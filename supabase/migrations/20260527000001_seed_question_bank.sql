-- =============================================================================
-- Seed: question_bank
-- Perguntas mapeadas por bloco temático para injeção no QuestionPlanner.
-- project_types NULL = relevante para todos os tipos de projeto.
-- Prioridade: 1 = alta, 2 = média, 3 = baixa
-- =============================================================================

INSERT INTO question_bank (block, project_types, text, priority) VALUES

-- ---------------------------------------------------------------------------
-- Negócio — todas as frentes precisam entender o contexto de negócio
-- ---------------------------------------------------------------------------
('negocio', NULL, 'Qual é a principal dor ou problema que este projeto resolve?', 1),
('negocio', NULL, 'Qual decisão de negócio precisa ser tomada com base nos dados?', 1),
('negocio', NULL, 'Quem são os usuários finais que vão consumir os resultados?', 1),
('negocio', NULL, 'Qual é o tipo de entrega esperada — dashboard, relatório, automação ou modelo?', 1),

-- ---------------------------------------------------------------------------
-- Engenharia de Dados — pipelines, fontes e qualidade
-- ---------------------------------------------------------------------------
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'Quantas fontes de dados diferentes existem no projeto?', 1),
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'Quais são os tipos de fonte — banco relacional, planilha, API ou arquivo?', 1),
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'Qual é a qualidade atual dos dados — há inconsistências, duplicatas ou campos vazios?', 1),
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'Com que frequência os dados precisam ser atualizados?', 2),
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'Existe algum processo manual de coleta ou transformação de dados hoje?', 2),
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'Quais sistemas precisam ser integrados para extrair os dados?', 2),
('eng_dados', ARRAY['bi','ml','data_engineering','science'], 'O cliente já possui um Data Warehouse ou Data Lake?', 1),

-- ---------------------------------------------------------------------------
-- Visualização — dashboards e KPIs
-- ---------------------------------------------------------------------------
('visualizacao', ARRAY['bi'], 'O cliente precisa de um dashboard interativo como entrega?', 1),
('visualizacao', ARRAY['bi'], 'Qual é a complexidade esperada do dashboard — simples, médio ou elaborado?', 2),
('visualizacao', ARRAY['bi'], 'Quantos KPIs precisam ser monitorados?', 1),
('visualizacao', ARRAY['bi'], 'Qual nível de interação o usuário precisa — filtros, drill-down, exportação?', 2),
('visualizacao', ARRAY['bi'], 'Com que frequência o dashboard vai ser consultado?', 3),
('visualizacao', ARRAY['bi'], 'Os KPIs e métricas já estão definidos ou precisam ser levantados com o cliente?', 1),

-- ---------------------------------------------------------------------------
-- Ciência de Dados — análise, IA e modelos
-- ---------------------------------------------------------------------------
('ciencia_dados', ARRAY['ml','science'], 'Qual tipo de análise está sendo esperada — descritiva, preditiva ou prescritiva?', 1),
('ciencia_dados', ARRAY['ml','science'], 'O projeto requer algum componente de inteligência artificial?', 1),
('ciencia_dados', ARRAY['ml','science'], 'Qual é o volume estimado de dados disponíveis para treinamento ou análise?', 1),
('ciencia_dados', ARRAY['ml','science'], 'O cliente possui histórico de dados rotulados ou base de conhecimento disponível?', 2),
('ciencia_dados', ARRAY['ml','science'], 'Se for um agente de IA, qual é o tipo esperado — chatbot, classificador ou recomendador?', 2),

-- ---------------------------------------------------------------------------
-- Automação — processos e fluxos
-- ---------------------------------------------------------------------------
('automacao', ARRAY['automation'], 'Existe um processo manual hoje que este projeto vai automatizar?', 1),
('automacao', ARRAY['automation'], 'Quantas etapas compõem esse processo?', 1),
('automacao', ARRAY['automation'], 'Existem regras de decisão claras no fluxo — condicionais com if/else?', 2),
('automacao', ARRAY['automation'], 'O fluxo pode falhar no meio do processo? Como deve se comportar nesse caso?', 1),
('automacao', ARRAY['automation'], 'Em caso de falha, é necessário reprocessamento automático?', 2),
('automacao', ARRAY['automation'], 'O cliente usa ou quer usar alguma ferramenta de visualização de fluxo, como n8n?', 3),

-- ---------------------------------------------------------------------------
-- Integração — sistemas e APIs
-- ---------------------------------------------------------------------------
('integracao', ARRAY['integration','data_engineering'], 'Quantos sistemas diferentes precisam ser conectados?', 1),
('integracao', ARRAY['integration','data_engineering'], 'Quais são os sistemas envolvidos na integração?', 1),
('integracao', ARRAY['integration','data_engineering'], 'As APIs dos sistemas estão documentadas?', 1),
('integracao', ARRAY['integration','data_engineering'], 'As APIs são estáveis ou mudam com frequência?', 2),
('integracao', ARRAY['integration','data_engineering'], 'A autenticação dos sistemas é complexa — OAuth, certificados ou tokens rotativos?', 2),
('integracao', ARRAY['integration','data_engineering'], 'Os sistemas são bem organizados ou há inconsistências e legados caóticos?', 1),

-- ---------------------------------------------------------------------------
-- Consumo / Interface — como os usuários vão acessar os resultados
-- ---------------------------------------------------------------------------
('consumo', NULL, 'O sistema precisa de integração com WhatsApp ou outros canais de mensagem?', 2),
('consumo', NULL, 'É necessária uma interface personalizada além do dashboard padrão?', 2),
('consumo', NULL, 'O sistema precisa responder em tempo real ou pode ter latência de alguns segundos?', 1),

-- ---------------------------------------------------------------------------
-- Parceria — prazo, urgência e ponto de contato
-- ---------------------------------------------------------------------------
('parceria', NULL, 'Qual é o prazo esperado para entrega do projeto?', 1),
('parceria', NULL, 'Qual é o nível de urgência — há uma data crítica ou o prazo é flexível?', 1),
('parceria', NULL, 'Já existe um ponto focal técnico definido do lado do cliente?', 2);
