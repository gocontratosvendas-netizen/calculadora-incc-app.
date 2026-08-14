/**
 * Conteúdo do site institucional — Paludetto Advogados Associados.
 *
 * RESTRIÇÕES OAB (Provimento nº 205/2021, Provimento nº 112/2006, Lei 8.906/94):
 * - Tom informativo, discreto e sóbrio. Nunca publicitário.
 * - Proibido: promessa/garantia de resultado, percentuais de êxito, valores recuperados,
 *   depoimentos, avaliações, comparação com outros escritórios, urgência/escassez,
 *   termos mercantis ("promoção", "pacote", "consultoria grátis"), uso de "especialista"
 *   sem título formal, chat/iscas de captação, WhatsApp flutuante comercial.
 * - Obrigatório: nº OAB da sociedade visível; aviso de caráter meramente informativo;
 *   aviso no formulário de que o envio não constitui relação advogado-cliente.
 * Qualquer edição de texto deve respeitar estas regras. Em conflito com práticas de
 * marketing, as restrições da OAB prevalecem.
 */

export type NavItem = { label: string; href: string }

export type Pillar = {
  title: string
  description: string
  icon: 'document' | 'userCheck' | 'chat'
}

export type PracticeArea = {
  number: string
  title: string
  tags: string[]
  description: string
}

export type MethodStep = {
  label: string
  title: string
  description: string
}

export type TeamMember = {
  name: string
  role: string
  bio: string
  oab: string
  formation: string[]
  associations: string[]
  photoSrc?: string
  photoAlt?: string
}

export type Article = {
  meta: string
  title: string
  summary: string
  href?: string
}

export type ContactLine = {
  icon: 'pin' | 'mail' | 'phone'
  text: string
  href?: string
}

export const site = {
  meta: {
    title:
      'Paludetto Advogados Associados | Direito imobiliário, consumidor e contratual — São Paulo',
    description:
      'Sociedade de advogados em São Paulo com atuação em direito imobiliário, do consumidor, civil e empresarial. Análise documental própria e acompanhamento direto de cada caso.',
  },

  topBar: {
    oab: 'Sociedade de advogados inscrita na OAB/SP sob nº 00.000',
    phone: '(11) 0000-0000',
    phoneHref: 'tel:+551100000000',
    linkedInHref: 'https://www.linkedin.com/',
  },

  brand: {
    wordmark: 'PALUDETTO',
    signature: 'ADVOGADOS ASSOCIADOS',
  },

  nav: [
    { label: 'O escritório', href: '#escritorio' },
    { label: 'Atuação', href: '#atuacao' },
    { label: 'Método', href: '#metodo' },
    { label: 'Equipe', href: '#equipe' },
    { label: 'Artigos', href: '#artigos' },
  ] as NavItem[],

  contactCta: { label: 'Contato', href: '#contato' },

  hero: {
    label: 'SÃO PAULO · DESDE 2019',
    title: 'Contratos são lidos com atenção. Ou não são lidos.',
    body: 'Atuamos em direito imobiliário, consumidor, civil e empresarial, com análise documental própria e acompanhamento direto de cada caso — do primeiro parecer à execução da sentença.',
    primaryCta: { label: 'Agendar uma conversa', href: '#contato' },
    secondaryCta: { label: 'Conhecer o escritório', href: '#escritorio' },
  },

  pillars: [
    {
      icon: 'document',
      title: 'Análise documental própria',
      description: 'Cálculos e memoriais elaborados internamente',
    },
    {
      icon: 'userCheck',
      title: 'Interlocução direta',
      description: 'Você fala com quem conduz o processo',
    },
    {
      icon: 'chat',
      title: 'Linguagem sem rodeio',
      description: 'Cenários e riscos ditos com clareza',
    },
  ] as Pillar[],

  about: {
    label: 'O ESCRITÓRIO',
    title: 'Uma banca pequena, por escolha',
    paragraphs: [
      'Paludetto Advogados Associados nasceu da constatação de que boa parte dos litígios contratuais se decide na fase de leitura — muito antes da petição inicial. Por isso mantemos uma estrutura enxuta e uma carteira deliberadamente limitada: cada contrato é lido inteiro, cláusula por cláusula, pelo advogado que vai sustentar a tese.',
      'Não prometemos resultado — nenhum advogado sério promete. Apresentamos o cenário, o risco, o custo e o horizonte de tempo, e deixamos a decisão com quem é dela.',
    ],
    quote:
      'A diferença entre um contrato justo e um contrato caro costuma estar em uma cláusula que ninguém releu.',
    attribution: 'VITOR PALUDETTO',
  },

  practiceAreas: {
    label: 'ÁREAS DE ATUAÇÃO',
    title: 'Quatro frentes, uma abordagem',
    seeAll: { label: 'Ver todas', href: '#atuacao' },
    items: [
      {
        number: '01',
        title: 'Direito imobiliário',
        tags: ['Imóvel na planta', 'Atraso de obra', 'Distrato'],
        description:
          'Contratos de aquisição de longo prazo, índices de correção monetária, prazos de entrega e rescisão. Área em que concentramos a maior parte da produção técnica do escritório.',
      },
      {
        number: '02',
        title: 'Direito do consumidor',
        tags: ['Cláusulas abusivas', 'Cobrança indevida'],
        description:
          'Revisão de cláusulas à luz do CDC, repetição de indébito e defesa em relações de consumo de trato continuado.',
      },
      {
        number: '03',
        title: 'Direito civil e contratos',
        tags: ['Revisão contratual', 'Responsabilidade civil'],
        description:
          'Elaboração, auditoria e revisão de instrumentos particulares, obrigações e reparação de danos.',
      },
      {
        number: '04',
        title: 'Direito empresarial',
        tags: ['Societário', 'Contratos empresariais'],
        description:
          'Constituição e reorganização societária, acordos de sócios e estruturação contratual de operações.',
      },
    ] as PracticeArea[],
  },

  method: {
    label: 'COMO TRABALHAMOS',
    title: 'Três etapas, sem surpresa no meio',
    steps: [
      {
        label: 'ETAPA 01',
        title: 'Leitura e diagnóstico',
        description:
          'Análise integral do contrato e dos comprovantes, com identificação das teses cabíveis e das que não são.',
      },
      {
        label: 'ETAPA 02',
        title: 'Parecer e cenários',
        description:
          'Memorial de cálculo, fundamentos, riscos processuais e estimativa realista de prazo. Por escrito.',
      },
      {
        label: 'ETAPA 03',
        title: 'Condução',
        description:
          'Ajuizamento, acompanhamento e relatório periódico de andamento, sem que você precise perguntar.',
      },
    ] as MethodStep[],
  },

  team: {
    label: 'EQUIPE',
    members: [
      {
        name: 'Vitor Paludetto',
        role: 'SÓCIO FUNDADOR',
        bio: 'Advogado com atuação concentrada em direito contratual, imobiliário e do consumidor. Dedica-se à análise técnica de contratos de longo prazo e à discussão judicial de cláusulas de correção monetária, tema sobre o qual desenvolve metodologia própria de cálculo e memorial.',
        oab: 'OAB/SP 000.000',
        formation: ['Bacharel em Direito', 'Pós-graduação em Direito Civil'],
        associations: ['Comissão de Direito Imobiliário', 'OAB/SP'],
      },
    ] as TeamMember[],
  },

  articles: {
    label: 'PUBLICAÇÕES',
    title: 'Artigos recentes',
    seeAll: { label: 'Todos os artigos', href: '#artigos' },
    items: [
      {
        meta: 'IMOBILIÁRIO · MAR 2026',
        title: 'Correção monetária em contratos de aquisição na planta',
        summary:
          'O que a Lei 10.931/2004 estabelece sobre periodicidade de reajuste.',
      },
      {
        meta: 'CONSUMIDOR · FEV 2026',
        title: 'Repetição de indébito: simples ou em dobro?',
        summary:
          'Como os tribunais têm tratado o requisito da má-fé no art. 42 do CDC.',
      },
      {
        meta: 'CIVIL · JAN 2026',
        title: 'A cláusula que ninguém lê: prazo e sua contagem',
        summary: 'Parcelas residuais e o alongamento artificial de contratos.',
      },
    ] as Article[],
  },

  contact: {
    label: 'CONTATO',
    title: 'Traga o contrato. A leitura começa aí.',
    body: 'Atendimento mediante agendamento prévio, presencial ou por videoconferência.',
    lines: [
      {
        icon: 'pin',
        text: 'Av. Paulista, 0000 · cj. 000 · São Paulo/SP',
      },
      {
        icon: 'mail',
        text: 'contato@paludetto.adv.br',
        href: 'mailto:contato@paludetto.adv.br',
      },
      {
        icon: 'phone',
        text: '(11) 0000-0000',
        href: 'tel:+551100000000',
      },
    ] as ContactLine[],
    form: {
      nameLabel: 'Nome',
      emailLabel: 'E-mail',
      phoneLabel: 'Telefone',
      subjectLabel: 'Assunto',
      consentLabel:
        'Autorizo o contato e o tratamento dos meus dados para esta finalidade.',
      submitLabel: 'Enviar mensagem',
      submittingLabel: 'Enviando…',
      successMessage:
        'Mensagem recebida. Retornaremos em até dois dias úteis.',
      errorMessage: 'Não foi possível enviar. Tente novamente.',
      legalNotice:
        'O envio desta mensagem não constitui relação advogado-cliente nem configura consulta jurídica.',
    },
  },

  footer: {
    navTitle: 'NAVEGAÇÃO',
    nav: [
      { label: 'O escritório', href: '#escritorio' },
      { label: 'Áreas de atuação', href: '#atuacao' },
      { label: 'Método', href: '#metodo' },
      { label: 'Artigos', href: '#artigos' },
    ] as NavItem[],
    practiceTitle: 'ATUAÇÃO',
    practice: [
      { label: 'Imobiliário', href: '#atuacao' },
      { label: 'Consumidor', href: '#atuacao' },
      { label: 'Civil e contratos', href: '#atuacao' },
      { label: 'Empresarial', href: '#atuacao' },
    ] as NavItem[],
    noticeTitle: 'AVISO',
    notice:
      'Este site tem caráter meramente informativo, em conformidade com o Provimento nº 205/2021 do Conselho Federal da OAB. Não constitui oferta de serviços nem promessa de resultado.',
    copyright: 'Paludetto Advogados Associados · OAB/SP nº 00.000',
    privacy: 'Política de privacidade',
    privacyHref: '#',
    lgpd: 'LGPD',
    lgpdHref: '#',
  },
} as const
