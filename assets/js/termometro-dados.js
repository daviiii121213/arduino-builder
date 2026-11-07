/* Gerado por tools/gerar_termometro.py a partir de Planilha_Completa_Questionario_Projeto_Genesis_V5_Corrigida.xlsx. Não edite à mão. V5: cada linha da matriz tem gravidade própria (campo codigos). */
(function (root) {
  var DADOS = {
    "fonte": "Planilha_Completa_Questionario_Projeto_Genesis_V5_Corrigida.xlsx",
    "titulo": "PROJETO GÊNESIS — DIAGNÓSTICO INTEGRADO E MATRIZ QUANTITATIVA DE RISCOS",
    "diretriz": "DIRETRIZ DE PREENCHIMENTO: Avalie a gravidade do sintoma de 0 a 10 (0 = Totalmente sob controle / Inexistente  |  10 = Risco Crítico / Gargalo Gravíssimo na Operação).",
    "tituloLaudo": "PROJETO GÊNESIS — LAUDO DE APURAÇÃO, TERMÔMETRO ORGANIZACIONAL E PLANO DE TRATAMENTO",
    "conselho": "Conselho Integrativo Multidisciplinar: Finanças & Estratégia · Gestão de Pessoas & Cultura · Saúde Integrativa · Auditoria & Compliance Trabalhista",
    "indicadores": [
      {
        "codigo": "F1",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Fluxo de Caixa e Lucro",
        "pergunta": "A empresa cresce em faturamento, mas o lucro não acompanha e há insegurança na tomada de decisões por falta de números confiáveis?",
        "peso": 1.5
      },
      {
        "codigo": "F2",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Precificação e Margens",
        "pergunta": "Existe insegurança na formação de preços/margens e confusão recorrente entre as contas da Pessoa Física (sócios) e Pessoa Jurídica?",
        "peso": 1.2
      },
      {
        "codigo": "F3",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Custos e Desperdícios",
        "pergunta": "Falta controle detalhado sobre custos e despesas operacionais, gerando vazamento contínuo de caixa e retrabalhos financeiros?",
        "peso": 1.0
      },
      {
        "codigo": "C1",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Tração Comercial e Vendas",
        "pergunta": "A empresa sofre com vendas instáveis no mês, falta de um processo comercial previsível ou dependência de poucos clientes para fechar as contas?",
        "peso": 1.2
      },
      {
        "codigo": "E1",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Dependência do Fundador",
        "pergunta": "A empresa depende criticamente da presença do sócio/fundador para quase tudo, travando o crescimento na ausência dele?",
        "peso": 1.5
      },
      {
        "codigo": "E2",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Planejamento e Rotina",
        "pergunta": "A liderança vive no modo 'apagar incêndios', sem planejamento tático claro para os próximos 6 a 12 meses e sem metas estruturadas?",
        "peso": 1.2
      },
      {
        "codigo": "E3",
        "pilar": "1. Gestão, Finanças & Comercial",
        "dimensao": "Continuidade e Sucessão",
        "pergunta": "A empresa enfrenta barreiras para expandir de forma sustentável, criar valor de mercado contínuo ou preparar o negócio para sucessão futura?",
        "peso": 1.0
      },
      {
        "codigo": "L1",
        "pilar": "2. Liderança, Cultura & Pessoas",
        "dimensao": "Produtividade e Papéis",
        "pergunta": "A equipe apresenta baixa produtividade, entregas desalinhadas e falta de clareza sobre funções e responsabilidades?",
        "peso": 1.0
      },
      {
        "codigo": "L2",
        "pilar": "2. Liderança, Cultura & Pessoas",
        "dimensao": "Postura dos Líderes",
        "pergunta": "Os líderes são excessivamente centralizadores, com dificuldades de delegar, orientar, dar feedbacks construtivos e cobrar metas?",
        "peso": 1.2
      },
      {
        "codigo": "L3",
        "pilar": "2. Liderança, Cultura & Pessoas",
        "dimensao": "Sobrecarga da Gestão",
        "pergunta": "Os gestores e líderes estão afogados nas rotinas operacionais diárias, exaustos e sem tempo de gerir e desenvolver suas equipes?",
        "peso": 1.5
      },
      {
        "codigo": "L4",
        "pilar": "2. Liderança, Cultura & Pessoas",
        "dimensao": "Clima e Comunicação",
        "pergunta": "O clima organizacional está pesado, marcado por ruídos de comunicação, intrigas interdepartamentais ou fofocas que travam a harmonia?",
        "peso": 1.0
      },
      {
        "codigo": "L5",
        "pilar": "2. Liderança, Cultura & Pessoas",
        "dimensao": "Treinamento e Turnover",
        "pergunta": "A empresa tem alta rotatividade (turnover) ou dificuldade para reter talentos, somada à ausência de rotinas de treinamento e desenvolvimento?",
        "peso": 1.2
      },
      {
        "codigo": "S1",
        "pilar": "3. Saúde Integrativa & Comportamento",
        "dimensao": "Saúde e Esgotamento",
        "pergunta": "Sócios e líderes relatam insônia frequente, exaustão física/mental severa, estresse excessivo ou episódios que beiram o Burnout?",
        "peso": 1.5
      },
      {
        "codigo": "S2",
        "pilar": "3. Saúde Integrativa & Comportamento",
        "dimensao": "Absenteísmo e Presenteísmo",
        "pergunta": "Existe alta recorrência de atestados médicos (ansiedade/estresse) ou colaboradores 'presentes mas improdutivos' por fadiga e desânimo?",
        "peso": 1.2
      },
      {
        "codigo": "S3",
        "pilar": "3. Saúde Integrativa & Comportamento",
        "dimensao": "Fadiga e Ritmo Circadiano",
        "pergunta": "Sente 'névoa mental' (dificuldade de foco), cansaço extremo ao final do dia, falta de disposição matinal ou troca do dia pela noite?",
        "peso": 1.2
      },
      {
        "codigo": "R1",
        "pilar": "3. Saúde Integrativa & Comportamento",
        "dimensao": "Vícios Comportamentais",
        "pergunta": "Líderes e colaboradores encontram-se presos em ciclos repetitivos de erros, procrastinação, autossabotagem e reatividade emocional?",
        "peso": 1.2
      },
      {
        "codigo": "R2",
        "pilar": "3. Saúde Integrativa & Comportamento",
        "dimensao": "Resistência à Mudança",
        "pergunta": "Há resistência rígida a novos processos e tecnologias, apego a hábitos ultrapassados e incapacidade de sustentar disciplina nas mudanças?",
        "peso": 1.0
      },
      {
        "codigo": "A1",
        "pilar": "4. Auditoria & Compliance Trabalhista",
        "dimensao": "Registro e Vínculos",
        "pergunta": "Existem colaboradores atuando sem o devido registro em CTPS, pagamentos de remunerações 'por fora' ou desvios de função graves?",
        "peso": 1.5
      },
      {
        "codigo": "A2",
        "pilar": "4. Auditoria & Compliance Trabalhista",
        "dimensao": "Documentação e Proteção",
        "pergunta": "Os kits admissionais, contratos de trabalho, recibos de entrega de EPIs e termos de sigilo/LGPD estão incompletos, desatualizados ou sem assinatura?",
        "peso": 1.2
      },
      {
        "codigo": "A3",
        "pilar": "4. Auditoria & Compliance Trabalhista",
        "dimensao": "Passivos Ocultos de DP",
        "pergunta": "O departamento pessoal possui controles frágeis de ponto, horas extras acumuladas sem acordo ou férias vencidas que criam passivos ocultos?",
        "peso": 1.2
      }
    ],
    "pilares": [
      {
        "nome": "1. Gestão, Finanças & Comercial",
        "especialistas": "Ana Lúcia",
        "codigos": [
          "F1",
          "F2",
          "F3",
          "C1",
          "E1",
          "E2",
          "E3"
        ],
        "prescricoes": [
          "ESTANCAMENTO DE EMERGÊNCIA: Intervenção urgente em caixa, choque de precificação e contenção de vazamentos operacionais.",
          "REESTRUTURAÇÃO TÁTICA: Revisão de margens, implantação de DRE gerencial, funil comercial e redução da dependência do dono.",
          "AJUSTES PREVENTIVOS: Padronização de rotinas financeiras, metas comerciais estruturadas e matriz de processos.",
          "EXPANSÃO E GOVERNANÇA: Governança continuada, inovação e preparação para novos mercados/escala."
        ]
      },
      {
        "nome": "2. Liderança, Cultura & Pessoas",
        "especialistas": "Franciele · Isabela · Vitor",
        "codigos": [
          "L1",
          "L2",
          "L3",
          "L4",
          "L5"
        ],
        "prescricoes": [
          "MEDIAÇÃO DE CRISE: Intervenção direta na cúpula, contenção emergencial de turnover e realinhamento imediato de papéis.",
          "DESENVOLVIMENTO DE LÍDERES: Capacitação em delegação, cultura de feedback, plano de desenvolvimento e redução de conflitos.",
          "ALINHAMENTO DE EQUIPE: Workshop de comunicação, clareza de atribuições e fortalecimento do engajamento.",
          "ALTA PERFORMANCE: Rituais contínuos de cultura forte, mentoria executiva e retenção de talentos-chave."
        ]
      },
      {
        "nome": "3. Saúde Integrativa & Comportamento",
        "especialistas": "Dra. Lara Guerra · Dr. Roberto",
        "codigos": [
          "S1",
          "S2",
          "S3",
          "R1",
          "R2"
        ],
        "prescricoes": [
          "PROTOCOLO DE CHOQUE: Avaliação emergencial de riscos psicossociais (NR-1) e suporte integrativo aos sócios à beira do Burnout.",
          "REEDUCAÇÃO COMPORTAMENTAL: Protocolo de regulação do estresse, higiene do sono e quebra de vícios de repetição de erros.",
          "PREVENÇÃO E BEM-ESTAR: Acompanhamento de rotinas produtivas, ergonomia mental e gestão de energia na rotina.",
          "SAÚDE E LONGEVIDADE: Manutenção da saúde biológica, neuroplasticidade e equilíbrio sustentável de vida-trabalho."
        ]
      },
      {
        "nome": "4. Auditoria & Compliance Trabalhista",
        "especialistas": "Ilda Martins",
        "codigos": [
          "A1",
          "A2",
          "A3"
        ],
        "prescricoes": [
          "BLINDAGEM JURÍDICA URGENTE: Auditoria imediata de contratos, saneamento de passivos trabalhistas graves e regularização de pessoal.",
          "REGULARIZAÇÃO DE CONFORMIDADE: Atualização de kits admissionais, controle rígido de ponto/férias e adequação de funções.",
          "ORGANIZAÇÃO DE DP: Padronização de arquivos trabalhistas, recibos de EPIs e revisão preventiva de contratos.",
          "COMPLIANCE CONTÍNUO: Auditorias periódicas, segurança jurídica plena e proteção total do patrimônio dos sócios."
        ]
      }
    ],
    "limites": [
      8.0,
      5.5,
      3.0
    ],
    "temperaturas": [
      "39.5°C+ (Febre Alta / UTI)",
      "38.5°C (Febre Ativa / Alerta)",
      "37.2°C (Estado Subfebril)",
      "36.2°C (Ideal / Saudável)"
    ],
    "status": [
      "VERMELHO (CRÍTICO)",
      "AMARELO (GARGALO ATIVO)",
      "BRANCO (RISCO INICIAL)",
      "VERDE (SAUDÁVEL)"
    ],
    "igvo": {
      "nome": "ÍNDICE GLOBAL DE VULNERABILIDADE (IGVO)",
      "responsaveis": "Mesa Completa do Conselho",
      "prescricoes": [
        "INTERVENÇÃO EMERGENCIAL GÊNESIS: Convocação extraordinária de todo o Conselho para plano de contingência e estancamento de riscos.",
        "CICLO DE TRATAMENTO GÊNESIS (6 OU 12 MESES): Execução prioritária nas áreas inflamadas para reverter perdas e restaurar lucro e saúde.",
        "PROGRAMA DE PREVENÇÃO E BLINDAGEM: Ajustes finos estruturais com os especialistas antes que os sintomas virem custos.",
        "PROGRAMA CONTINUADO DE GOVERNANÇA: Acompanhamento estratégico para expansão sustentável e valorização do negócio."
      ]
    },
    "matriz": [
      {
        "dimensao": "Finanças & Comercial",
        "pilar": 0,
        "codigos": ["F1", "F2", "F3", "C1"],
        "gatilhos": [
          "O faturamento cresce, mas o lucro não acompanha.",
          "Insegurança nas margens e confusão entre PF e PJ.",
          "Vendas instáveis e dependência de poucos clientes."
        ],
        "causas": [
          "Falta de controle em Fluxo de Caixa e DRE gerencial.",
          "Ausência de precificação técnica baseada em margem de contribuição.",
          "Inexistência de funil comercial estruturado e processos de vendas."
        ],
        "beneficios": [
          "Visibilidade total do caixa e lucro real na última linha.",
          "Margens blindadas e separação definitiva entre PF e PJ.",
          "Previsibilidade de faturamento e vendas escaláveis."
        ],
        "conselheiros": [
          "Ana Lúcia"
        ],
        "modalidades": [
          "PLANO DE CHOQUE (Resultado Imediato):\nEstancamento urgente de vazamentos de caixa, corte emergencial de desperdícios e revisão rápida da precificação de sobrevivência.",
          "REESTRUTURAÇÃO TÁTICA (Médio Prazo):\nImplantação de DRE gerencial, rotinas financeiras diárias, metas de vendas e estruturação de funil comercial.",
          "GOVERNANÇA E ESCALA (Longo Prazo):\nControladoria avançada, inteligência comercial preditiva e governança financeira para valorização do negócio."
        ]
      },
      {
        "dimensao": "Estratégia & Continuidade",
        "pilar": 0,
        "codigos": ["E1", "E2", "E3"],
        "gatilhos": [
          "A empresa depende do dono para absolutamente tudo.",
          "Liderança presa no modo 'apagar incêndios' diário.",
          "Falta de clareza sobre o rumo da empresa nos próximos anos."
        ],
        "causas": [
          "Centralização excessiva e ausência de processos padronizados.",
          "Falta de planejamento estratégico tático e indicadores-chave (KPIs).",
          "Inexistência de plano de continuidade e preparação para sucessão."
        ],
        "beneficios": [
          "Empresa com autonomia para rodar sem a presença física do sócio.",
          "Direcionamento claro, foco executivo e metas descomplicadas.",
          "Preparação para expansão sustentável, atração de sócios ou sucessão."
        ],
        "conselheiros": [
          "Ana Lúcia"
        ],
        "modalidades": [
          "PLANO DE CHOQUE (Resultado Imediato):\nDescentralização forçada de rotinas críticas, matriz de delegação rápida e plano emergencial de contingência de 30 dias.",
          "REESTRUTURAÇÃO TÁTICA (Médio Prazo):\nConstrução do Planejamento Tático de 12 meses, desenho dos processos-chave e implantação de rituais de governança.",
          "GOVERNANÇA E ESCALA (Longo Prazo):\nConselho Consultivo continuado, estruturação societária, valuation contínuo e plano de sucessão familiar/profissional."
        ]
      },
      {
        "dimensao": "Pessoas, Liderança & Cultura",
        "pilar": 1,
        "codigos": ["L1", "L2", "L3", "L4", "L5"],
        "gatilhos": [
          "A equipe não entrega os resultados esperados.",
          "Líderes centralizadores, inseguros ou sobrecarregados.",
          "Clima pesado, conflitos departamentais e fofocas corporativas."
        ],
        "causas": [
          "Falta de clareza nos papéis, funções e níveis de autoridade.",
          "Ausência de capacitação em liderança, delegação e feedback.",
          "Contratações desalinhadas e falta de um plano de cargos e evolução."
        ],
        "beneficios": [
          "Equipe autônoma, engajada e comprometida com metas.",
          "Líderes preparados que desenvolvem pessoas e cobram resultados com maturidade.",
          "Clima leve, comunicação fluida e redução drástica de ruídos."
        ],
        "conselheiros": [
          "Franciele Mendonça",
          "Isabela Ortega",
          "Vitor Rodrigues"
        ],
        "modalidades": [
          "PLANO DE CHOQUE (Resultado Imediato):\nMediação emergencial de conflitos na diretoria/equipe, alinhamento de papéis urgentes e contenção de debandada de talentos.",
          "REESTRUTURAÇÃO TÁTICA (Médio Prazo):\nPrograma de Desenvolvimento de Líderes (PDL), rituais de feedback, organograma funcional e plano de cargos e salários.",
          "GOVERNANÇA E ESCALA (Longo Prazo):\nCultura organizacional forte e autossustentável, universidade corporativa e formação contínua de novos sucessores."
        ]
      },
      {
        "dimensao": "Saúde Integrativa & Alta Performance",
        "pilar": 2,
        "codigos": ["S1", "S2", "S3"],
        "gatilhos": [
          "Sócios e gestores exaustos, sem energia e com insônia frequente.",
          "'Névoa mental', dificuldade de concentração e estresse crônico.",
          "Alta frequência de atestados médicos ou colaboradores desmotivados."
        ],
        "causas": [
          "Sobrecarga psicofisiológica extrema e ritmo circadiano desregulado.",
          "Ausência de regulação do estresse e estilo de vida inflamatório corporativo.",
          "Riscos psicossociais não mapeados no ambiente corporativo (NR-1)."
        ],
        "beneficios": [
          "Gestores com clareza mental, vigor físico e equilíbrio de sono e rotina.",
          "Redução expressiva do absenteísmo e do custo invisível do presenteísmo.",
          "Ambiente de trabalho produtivo, saudável e biologicamente sustentável."
        ],
        "conselheiros": [
          "Dra. Lara Guerra",
          "Dr. Roberto Rocha"
        ],
        "modalidades": [
          "PLANO DE CHOQUE (Resultado Imediato):\nAtendimento de suporte integrativo urgente para líderes em risco iminente de colapso/Burnout e diagnóstico emergencial de riscos NR-1.",
          "REESTRUTURAÇÃO TÁTICA (Médio Prazo):\nPrograma corporativo de saúde integrativa: regulação do sono/ciclo circadiano, redução de fadiga e gestão de energia no trabalho.",
          "GOVERNANÇA E ESCALA (Longo Prazo):\nAcompanhamento contínuo da saúde biológica da liderança, rituais corporativos de bem-estar e cultura de longevidade executiva."
        ]
      },
      {
        "dimensao": "Reeducação Corporativa",
        "pilar": 2,
        "codigos": ["R1", "R2"],
        "gatilhos": [
          "Líderes e equipes travados em vícios comportamentais e erros repetitivos.",
          "Resistência crônica a novas diretrizes e falta de disciplina.",
          "Padrões de autossabotagem, reatividade e medo de errar."
        ],
        "causas": [
          "Hábitos operacionais enraizados e baixa inteligência comportamental.",
          "Falta de ferramentas práticas para reprogramação de hábitos e foco.",
          "Dificuldade de sustentar mudanças após o fim de treinamentos tradicionais."
        ],
        "beneficios": [
          "Quebra definitiva de ciclos viciosos de erros e retrabalhos.",
          "Maturidade emocional para lidar com pressões, metas e novos desafios.",
          "Disciplina e constância aplicadas na rotina diária da empresa."
        ],
        "conselheiros": [
          "Equipe Multidisciplinar Gênesis"
        ],
        "modalidades": [
          "PLANO DE CHOQUE (Resultado Imediato):\nDesbloqueio comportamental emergencial para a cúpula: técnicas de neuroplasticidade para foco executivo e tomada de decisão sob pressão.",
          "REESTRUTURAÇÃO TÁTICA (Médio Prazo):\nPrograma prático de Reeducação Comportamental: reprogramação de hábitos, rotinas de disciplina e superação de autossabotagem.",
          "GOVERNANÇA E ESCALA (Longo Prazo):\nMentoria continuada em mentalidade executiva, maturidade relacional e alinhamento do propósito dos sócios com o negócio."
        ]
      },
      {
        "dimensao": "Auditoria & Compliance Trabalhista",
        "pilar": 3,
        "codigos": ["A1", "A2", "A3"],
        "gatilhos": [
          "Insegurança jurídica e medo constante de processos trabalhistas.",
          "Funcionários sem registro, pagamentos informais ou desvios de função.",
          "Documentos admissionais e recibos de EPIs perdidos ou desatualizados."
        ],
        "causas": [
          "Falta de auditoria preventiva nas rotinas do Departamento Pessoal (DP).",
          "Passivos trabalhistas ocultos acumulando juros e multas silenciosas.",
          "Fragilidade na comprovação documental de cumprimento da legislação e LGPD."
        ],
        "beneficios": [
          "Blindagem jurídica e tranquilidade absoluta para os sócios dormirem em paz.",
          "Departamento pessoal organizado, padronizado e em total conformidade.",
          "Eliminação de riscos de multas fiscalizatórias e redução drástica de passivos."
        ],
        "conselheiros": [
          "Ilda Martins",
          "Auditoria e Controladoria"
        ],
        "modalidades": [
          "PLANO DE CHOQUE (Resultado Imediato):\nAuditoria de emergência do passivo trabalhista: saneamento imediato de vínculos sem registro e regularização urgente de contratos críticos.",
          "REESTRUTURAÇÃO TÁTICA (Médio Prazo):\nRevisão completa dos kits admissionais, controle rígido de ponto e horas extras, adequação de funções e implementação de compliance de DP.",
          "GOVERNANÇA E ESCALA (Longo Prazo):\nAuditorias trabalhistas preventivas periódicas, compliance contínuo e blindagem jurídica permanente do patrimônio dos fundadores."
        ]
      }
    ],
    "limitesMatriz": [
      8.0,
      5.5
    ],
    "referencia": [
      {
        "faixa": "Notas de 0.0 a 2.9",
        "temperatura": "36.0°C a 36.5°C",
        "cor": "VERDE",
        "classificacao": "CENÁRIO SAUDÁVEL",
        "conduta": "Organismo empresarial forte e em equilíbrio. A liderança tem clareza dos números, processos organizados e equipe alinhada. Foco do Conselho: Governança contínua, ganho de escala e preparação de valor para o mercado."
      },
      {
        "faixa": "Notas de 3.0 a 5.4",
        "temperatura": "37.0°C a 37.5°C",
        "cor": "BRANCO",
        "classificacao": "ESTADO SUBFEBRIL (ATENÇÃO)",
        "conduta": "Sintomas iniciais de atrito e inflamação silenciosa. Falhas pontuais no caixa, desordem na delegação ou cansaço acumulado. Foco do Conselho: Prevenção estruturada, alinhamento de liderança e ajustes de processos antes que gerem custo financeiro."
      },
      {
        "faixa": "Notas de 5.5 a 7.9",
        "temperatura": "38.0°C a 39.0°C",
        "cor": "AMARELO",
        "classificacao": "FEBRE ATIVA (ALERTA)",
        "conduta": "Gargalos ativos e crônicos em operação. A empresa perde dinheiro, sofre com retrabalhos e a saúde da equipe/fundadores está sendo drenada. Foco do Conselho: Plano de Tratamento Integrado de 6 a 12 meses com atuação cirúrgica na causa raiz."
      },
      {
        "faixa": "Notas de 8.0 a 10.0",
        "temperatura": "39.5°C ou mais",
        "cor": "VERMELHO",
        "classificacao": "FEBRE ALTA / UTI (CRÍTICO)",
        "conduta": "Risco iminente de colapso. Asfixia financeira de caixa, vulnerabilidade jurídica trabalhista grave ou esgotamento físico/mental extremo (Burnout) dos sócios. Foco do Conselho: Intervenção de emergência para estancamento imediato de sangramento."
      }
    ]
  };
  if (typeof module === "object" && module.exports) module.exports = DADOS;
  else root.TERMOMETRO_DADOS = DADOS;
})(this);
