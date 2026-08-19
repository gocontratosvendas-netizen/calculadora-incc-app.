#!/usr/bin/env node
/**
 * Seed local (ou remoto) Supabase: usuários, parceiros, casos, mural, materiais.
 * Uso: node --env-file=.env.local scripts/seed.mjs
 * Requer VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'admin@admin.com',
    password: '123456',
    nome: 'Helena Duarte',
    iniciais: 'HD',
    papel: 'socio',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    email: 'vitor@verum.adv.br',
    password: '123456',
    nome: 'Vitor P.',
    iniciais: 'VP',
    papel: 'socio',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    email: 'rafaela@verum.adv.br',
    password: '123456',
    nome: 'Rafaela Moura',
    iniciais: 'RM',
    papel: 'socio',
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    email: 'lucas@verum.adv.br',
    password: '123456',
    nome: 'Lucas Ferreira',
    iniciais: 'LF',
    papel: 'advogado',
  },
  {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    email: 'camila@verum.adv.br',
    password: '123456',
    nome: 'Camila Barros',
    iniciais: 'CB',
    papel: 'advogado',
  },
  {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    email: 'paulo@verum.adv.br',
    password: '123456',
    nome: 'Paulo Mendes',
    iniciais: 'PM',
    papel: 'advogado',
  },
]

const IDS = {
  helena: USERS[0].id,
  vitor: USERS[1].id,
  rafaela: USERS[2].id,
  lucas: USERS[3].id,
  camila: USERS[4].id,
  paulo: USERS[5].id,
}

function diasAtras(dias) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

async function ensureUser(user) {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 })
  const existing = listed?.users?.find((u) => u.email === user.email || u.id === user.id)
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: user.password,
      email_confirm: true,
      user_metadata: { nome: user.nome, iniciais: user.iniciais, papel: user.papel },
    })
    await admin.from('profiles').upsert({
      id: existing.id,
      nome: user.nome,
      iniciais: user.iniciais,
      papel: user.papel,
    })
    await upsertCfgUsuario(existing.id, user)
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { nome: user.nome, iniciais: user.iniciais, papel: user.papel },
  })
  if (error) throw new Error(`createUser ${user.email}: ${error.message}`)
  await admin.from('profiles').upsert({
    id: data.user.id,
    nome: user.nome,
    iniciais: user.iniciais,
    papel: user.papel,
  })
  await upsertCfgUsuario(data.user.id, user)
  return data.user.id
}

async function upsertCfgUsuario(id, user) {
  const { error } = await admin.from('cfg_usuarios').upsert({
    id,
    nome: user.nome,
    email: user.email.toLowerCase(),
    papel_id: user.papel === 'socio' ? 'socio' : 'operacao',
    situacao: 'ativo',
  })
  if (error) console.warn('cfg_usuarios', user.email, error.message)
}

async function wipe() {
  // Ordem: filhos → pais. Tabelas sem coluna id usam filtro amplo.
  await admin.from('marcacoes').delete().neq('resumo', '__never__')
  await admin.from('post_curtidas').delete().neq('post_id', '__never__')
  await admin.from('comentarios').delete().neq('id', '__never__')
  await admin.from('post_mencoes').delete().gte('id', 0)
  await admin.from('posts').delete().neq('id', '__never__')
  await admin.from('documentos_caso').delete().neq('id', '__never__')
  await admin.from('prazos').delete().neq('id', '__never__')
  await admin.from('andamentos').delete().neq('id', '__never__')
  await admin.from('casos').delete().neq('id', '__never__')
  await admin.from('parceiros').delete().neq('id', '__never__')
  await admin.from('materiais').delete().neq('id', '__never__')
  await admin.from('itens_atencao').delete().neq('id', '__never__')
}

async function seedPapeisEBootstrap() {
  const { error: seedErr } = await admin.rpc('cfg_seed_papeis')
  if (seedErr) console.warn('cfg_seed_papeis:', seedErr.message)
  const appUrl = process.env.APP_URL || 'http://localhost:5173'
  await admin.rpc('cfg_definir_app_url', { p_url: appUrl })
  if (process.env.BOOTSTRAP_ONLY !== '1') return

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL
  const nome = process.env.BOOTSTRAP_ADMIN_NOME || 'Sócio'
  if (!email) {
    console.warn('BOOTSTRAP_ONLY exige BOOTSTRAP_ADMIN_EMAIL.')
    return
  }
  const { data, error } = await admin.rpc('cfg_bootstrap_socio', { p_email: email, p_nome: nome })
  if (error) {
    console.warn('bootstrap:', error.message)
    return
  }
  if (data?.skipped) return
  const { data: fila } = await admin.rpc('cfg_filhos_fila')
  const link = fila?.itens?.[0]?.payload?.link
  console.log('\n>>> Primeiro sócio criado (situação: convidado).')
  console.log('>>> Defina a senha neste link:')
  console.log(`>>> ${link || '(veja os logs do Postgres: CFG_INVITE_URL)'}\n`)
}

async function seedSociosDemo(ids) {
  const { count } = await admin.from('cfg_socios').select('*', { count: 'exact', head: true })
  if ((count ?? 0) > 0) return
  const socios = [
    {
      dataEntrada: '2020-01-15',
      usuarioId: ids.helena,
      nomeCompleto: 'Helena Duarte',
      cpf: '39053344705',
      email: 'admin@admin.com',
      participacao: 40,
      aporteComprometido: 600000,
      aporteIntegralizado: 600000,
    },
    {
      usuarioId: ids.vitor,
      nomeCompleto: 'Vitor P.',
      cpf: '52998224725',
      email: 'vitor@verum.adv.br',
      participacao: 35,
      aporteComprometido: 600000,
      aporteIntegralizado: 400000,
    },
    {
      usuarioId: ids.rafaela,
      nomeCompleto: 'Rafaela Moura',
      cpf: '15350946056',
      email: 'rafaela@verum.adv.br',
      participacao: 25,
      aporteComprometido: 600000,
      aporteIntegralizado: 600000,
    },
  ]
  for (const s of socios) {
    const { error } = await admin.rpc('cfg_criar_socio_seed', { payload: s })
    if (error) console.warn('cfg_criar_socio_seed', s.email, error.message)
  }
}

async function seed() {
  console.log('Preparando papéis e bootstrap…')
  await seedPapeisEBootstrap()
  if (process.env.BOOTSTRAP_ONLY === '1') return

  console.log('Criando usuários…')
  const ids = { ...IDS }
  for (const user of USERS) {
    const id = await ensureUser(user)
    if (user.nome.startsWith('Helena')) ids.helena = id
    if (user.nome.startsWith('Vitor')) ids.vitor = id
    if (user.nome.startsWith('Rafaela')) ids.rafaela = id
    console.log(`  ✓ ${user.email} (${id})`)
  }
  await seedSociosDemo(ids)

  if (process.env.SEED_CFG_ONLY === '1') {
    console.log('\nSeed de Configurações concluído (SEED_CFG_ONLY).')
    console.log('Login: admin@admin.com / 123456')
    return
  }

  console.log('Limpando dados de domínio…')
  await wipe()

  console.log('Inserindo parceiros…')
  const parceiros = [
    {
      id: 'par-001',
      nome: 'Imobiliária Vega',
      iniciais: 'IV',
      tipo: 'imobiliaria',
      detalhe: 'Pinheiros, SP',
      documento: null,
      contato_pessoa: 'Ana Vega',
      contato_cargo: 'Diretora comercial',
      contato_email: 'ana@vegaimob.com.br',
      contato_telefone: '(11) 98888-1001',
      estagio: 'ativa',
      responsavel_id: IDS.rafaela,
      proximo_passo: null,
      ultimo_contato_em: diasAtras(3),
      encerrada_em: null,
      observacoes: null,
      comissao_modelo: 'percentual_exito',
      comissao_percentual: 10,
      comissao_valor_por_caso: null,
      casos_indicados: 12,
      excesso_originado: 284500,
      criado_em: diasAtras(120),
    },
    {
      id: 'par-002',
      nome: 'Grupo Zenit',
      iniciais: 'GZ',
      tipo: 'administradora',
      detalhe: '42 condomínios',
      documento: null,
      contato_pessoa: 'Marcos Zenit',
      contato_cargo: 'Sócio',
      contato_email: 'marcos@grupozenit.com.br',
      contato_telefone: '(11) 97777-2002',
      estagio: 'ativa',
      responsavel_id: IDS.vitor,
      proximo_passo: null,
      ultimo_contato_em: diasAtras(8),
      encerrada_em: null,
      observacoes: null,
      comissao_modelo: 'misto',
      comissao_percentual: 8,
      comissao_valor_por_caso: 2500,
      casos_indicados: 8,
      excesso_originado: 196200,
      criado_em: diasAtras(90),
    },
    {
      id: 'par-003',
      nome: 'Assessoria Prime',
      iniciais: 'AP',
      tipo: 'assessoria_credito',
      detalhe: 'SP',
      documento: null,
      contato_pessoa: 'Paula Prime',
      contato_cargo: 'Sócia',
      contato_email: 'paula@assessoriprime.com.br',
      contato_telefone: null,
      estagio: 'ativa',
      responsavel_id: IDS.rafaela,
      proximo_passo: null,
      ultimo_contato_em: diasAtras(1),
      encerrada_em: null,
      observacoes: null,
      comissao_modelo: 'valor_fixo',
      comissao_percentual: null,
      comissao_valor_por_caso: 3000,
      casos_indicados: 5,
      excesso_originado: 112800,
      criado_em: diasAtras(60),
    },
    {
      id: 'par-004',
      nome: 'Costa & Lima',
      iniciais: 'CL',
      tipo: 'contabilidade',
      detalhe: 'carteira de investidores',
      documento: null,
      contato_pessoa: 'Fernanda Costa',
      contato_cargo: 'Sócia',
      contato_email: 'fernanda@costalima.cont.br',
      contato_telefone: '(11) 96666-4004',
      estagio: 'em_negociacao',
      responsavel_id: IDS.lucas,
      proximo_passo: 'Proposta de comissionamento enviada. Retorno previsto para 20/08.',
      ultimo_contato_em: diasAtras(2),
      encerrada_em: null,
      observacoes: null,
      comissao_modelo: 'a_definir',
      comissao_percentual: null,
      comissao_valor_por_caso: null,
      casos_indicados: 0,
      excesso_originado: 0,
      criado_em: diasAtras(20),
    },
    {
      id: 'par-005',
      nome: 'Ricardo Alves',
      iniciais: 'RA',
      tipo: 'sindico',
      detalhe: '9 prédios',
      documento: null,
      contato_pessoa: 'Ricardo Alves',
      contato_cargo: null,
      contato_email: null,
      contato_telefone: '(11) 95555-5005',
      estagio: 'prospeccao',
      responsavel_id: IDS.vitor,
      proximo_passo: 'Carta de parceria enviada. Aguardando primeira reunião.',
      ultimo_contato_em: diasAtras(5),
      encerrada_em: null,
      observacoes: null,
      comissao_modelo: 'a_definir',
      comissao_percentual: null,
      comissao_valor_por_caso: null,
      casos_indicados: 0,
      excesso_originado: 0,
      criado_em: diasAtras(12),
    },
    {
      id: 'par-006',
      nome: 'Imobiliária Horizonte',
      iniciais: 'IH',
      tipo: 'imobiliaria',
      detalhe: 'Santo Amaro, SP',
      documento: null,
      contato_pessoa: 'João Horizonte',
      contato_cargo: 'Gerente',
      contato_email: 'joao@horizonteimob.com.br',
      contato_telefone: '(11) 94444-6006',
      estagio: 'encerrada',
      responsavel_id: IDS.lucas,
      proximo_passo: null,
      ultimo_contato_em: '2026-04-15T12:00:00.000Z',
      encerrada_em: '2026-04-15T12:00:00.000Z',
      observacoes: null,
      comissao_modelo: 'percentual_exito',
      comissao_percentual: 10,
      comissao_valor_por_caso: null,
      casos_indicados: 3,
      excesso_originado: 64300,
      criado_em: diasAtras(400),
    },
  ]
  {
    const { error } = await admin.from('parceiros').insert(parceiros)
    if (error) throw error
  }

  console.log('Inserindo casos…')
  const casos = [
    {
      id: 'caso-001',
      cliente_nome: 'Marcos Almeida',
      cliente_email: 'marcos@email.com',
      cliente_telefone: '(11) 98812-4400',
      empreendimento: 'Henry Boulevard',
      incorporadora: 'Kallas',
      data_assinatura: '2021-03-10',
      valor_contrato: 780000,
      parcelas_reais: 28,
      parcelas_contrato: 37,
      parcela_residual: 100,
      situacao_obra: 'entregue',
      data_chaves: '2024-08-22',
      excesso_apurado: 23410,
      valor_causa: null,
      prescricao_em: '2027-08-22',
      status: 'processo_de_venda',
      parceiro_id: 'par-001',
      canal_origem: 'Indicação',
      responsavel_id: IDS.vitor,
      criterios: [
        { rotulo: 'Parcelas reais inferiores às do contrato', atendido: true },
        { rotulo: 'Obra entregue', atendido: true },
        { rotulo: 'Dentro do prazo prescricional', atendido: true },
        { rotulo: 'Memorial de cálculo disponível', atendido: true },
        { rotulo: 'Excesso apurado', atendido: true },
      ],
      atualizado_em: '2026-08-10T09:00:00-03:00',
    },
    {
      id: 'caso-002',
      cliente_nome: 'Erika Tanaka',
      empreendimento: 'Vila Nova 1200',
      incorporadora: 'Cyrela',
      valor_contrato: 1150000,
      excesso_apurado: 34820,
      valor_causa: 69640,
      data_protocolo: '2023-01-01',
      status: 'ajuizado',
      responsavel_id: IDS.rafaela,
      atualizado_em: '2026-08-11T11:20:00-03:00',
    },
    {
      id: 'caso-003',
      cliente_nome: 'Paula Ribeiro',
      empreendimento: 'Parque Cidade',
      incorporadora: 'MRV',
      valor_contrato: 520000,
      status: 'processo_de_venda',
      responsavel_id: IDS.vitor,
      atualizado_em: '2026-08-09T15:40:00-03:00',
    },
    {
      id: 'caso-004',
      cliente_nome: 'Luís Moreira',
      empreendimento: 'Alto da Lapa',
      incorporadora: 'Even',
      valor_contrato: 640000,
      excesso_apurado: 19070,
      status: 'processo_de_venda',
      responsavel_id: IDS.lucas,
      atualizado_em: '2026-08-12T08:30:00-03:00',
    },
    {
      id: 'caso-005',
      cliente_nome: 'Helena Costa',
      empreendimento: 'Reserva Ipê',
      incorporadora: 'Kallas',
      valor_contrato: 890000,
      excesso_apurado: 27150,
      valor_causa: 54300,
      data_protocolo: '2022-01-01',
      status: 'ajuizado',
      responsavel_id: IDS.rafaela,
      atualizado_em: '2026-08-13T14:10:00-03:00',
    },
    {
      id: 'caso-006',
      cliente_nome: 'Sérgio Nakamura',
      empreendimento: 'Jardins 900',
      incorporadora: 'Tegra',
      valor_contrato: 1420000,
      excesso_apurado: 42600,
      valor_causa: 85200,
      data_protocolo: '2022-01-01',
      status: 'encerrado',
      desfecho: 'procedente',
      valor_recuperado: 42600,
      responsavel_id: IDS.lucas,
      atualizado_em: '2026-08-08T17:00:00-03:00',
    },
    {
      id: 'caso-007',
      cliente_nome: 'Camila Barros',
      empreendimento: 'Vista Sul',
      incorporadora: 'MRV',
      valor_contrato: 470000,
      excesso_apurado: 14280,
      valor_causa: 28560,
      data_protocolo: '2023-01-01',
      status: 'ajuizado',
      responsavel_id: IDS.vitor,
      atualizado_em: '2026-08-14T10:05:00-03:00',
    },
  ]
  {
    const { error } = await admin.from('casos').insert(
      casos.map((c) => ({
        criterios: [],
        canal_origem: 'Direto',
        situacao_obra: 'em_andamento',
        parcelas_reais: 0,
        parcelas_contrato: 0,
        ...c,
      })),
    )
    if (error) throw error
  }

  console.log('Inserindo andamentos / prazos / documentos (caso-001)…')
  {
    const { error } = await admin.from('andamentos').insert([
      {
        id: 'and-001',
        caso_id: 'caso-001',
        tipo: 'documento',
        titulo: 'Memorial de cálculo recebido',
        descricao:
          'Cliente enviou o memorial pelo portal da Kallas. Apuração já rodada na calculadora.',
        data: '2026-08-14',
        autor_id: IDS.vitor,
        automatico: false,
        criado_em: diasAtras(0),
      },
      {
        id: 'and-002',
        caso_id: 'caso-001',
        tipo: 'calculo',
        titulo: 'Apuração concluída',
        descricao: 'Excesso de R$ 23.410 em 18 pagamentos. Relatório gerado.',
        data: '2026-08-14',
        autor_id: IDS.vitor,
        acao_rotulo: 'Abrir relatório',
        acao_destino: '/calculadora',
        automatico: false,
        criado_em: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'and-003',
        caso_id: 'caso-001',
        tipo: 'contato',
        titulo: 'Reunião de apresentação',
        descricao:
          'Cliente entendeu a tese e concordou em seguir. Pediu prazo para conversar com a esposa.',
        data: '2026-08-11',
        autor_id: IDS.rafaela,
        automatico: false,
        criado_em: diasAtras(3),
      },
      {
        id: 'and-004',
        caso_id: 'caso-001',
        tipo: 'sistema',
        titulo: 'Caso cadastrado',
        descricao: 'Indicação da Imobiliária Vega.',
        data: '2026-08-09',
        autor_id: IDS.rafaela,
        automatico: true,
        criado_em: diasAtras(5),
      },
    ])
    if (error) throw error
  }
  {
    const { error } = await admin.from('prazos').insert([
      {
        id: 'prz-001',
        caso_id: 'caso-001',
        titulo: 'Comprovantes de pagamento',
        descricao: 'Reunir comprovantes de pagamento faltantes antes do protocolo.',
        vence_em: '2026-08-28',
        concluido: false,
      },
    ])
    if (error) throw error
  }
  {
    const docs = [
      { chave: 'memorial', rotulo: 'Memorial de cálculo da incorporadora', obrigatorio: true },
      { chave: 'contrato', rotulo: 'Contrato de compra e venda', obrigatorio: false },
      { chave: 'chaves', rotulo: 'Termo de entrega de chaves', obrigatorio: false },
      { chave: 'comprovantes', rotulo: 'Comprovantes de pagamento', obrigatorio: false },
    ]
    const { error } = await admin.from('documentos_caso').insert(
      docs.map((d) => ({
        id: `doc-caso-001-${d.chave}`,
        caso_id: 'caso-001',
        ...d,
      })),
    )
    if (error) throw error
  }

  // docs padrão para demais casos
  const outros = ['caso-002', 'caso-003', 'caso-004', 'caso-005', 'caso-006', 'caso-007']
  const padrao = [
    { chave: 'memorial', rotulo: 'Memorial de cálculo da incorporadora', obrigatorio: true },
    { chave: 'contrato', rotulo: 'Contrato de compra e venda', obrigatorio: false },
    { chave: 'chaves', rotulo: 'Termo de entrega de chaves', obrigatorio: false },
    { chave: 'comprovantes', rotulo: 'Comprovantes de pagamento', obrigatorio: false },
  ]
  {
    const rows = outros.flatMap((casoId) =>
      padrao.map((d) => ({
        id: `doc-${casoId}-${d.chave}`,
        caso_id: casoId,
        ...d,
      })),
    )
    const { error } = await admin.from('documentos_caso').insert(rows)
    if (error) throw error
  }

  console.log('Inserindo mural…')
  const agora = Date.now()
  const hora = 60 * 60 * 1000
  const ontem = new Date(agora)
  ontem.setDate(ontem.getDate() - 1)
  ontem.setHours(16, 20, 0, 0)

  const TEXTO_1 =
    '@Vitor a Kallas contestou alegando que os 37 meses foram livremente pactuados. Alguém já enfrentou essa defesa? Subo a contestação na base hoje.'
  const TEXTO_3 =
    'Subi a nova versão da carta ao comprador em Materiais. O memorial virou documento obrigatório, não mais opcional. @todos usem essa daqui pra frente.'

  {
    const { error } = await admin.from('posts').insert([
      {
        id: 'post-1',
        tipo: 'usuario',
        autor_id: IDS.rafaela,
        texto: TEXTO_1,
        caso_id: 'caso-002',
        caso_snapshot: {
          id: 'caso-002',
          cliente: 'Erika Tanaka',
          empreendimento: 'Vila Nova 1200',
          status: 'Ajuizado',
          excesso: 34820,
        },
        restrito_a_socios: false,
        criado_em: new Date(agora - 2 * hora).toISOString(),
      },
      {
        id: 'post-2',
        tipo: 'atualizacao',
        autor_id: null,
        texto:
          'Sentença favorável em Helena Costa · Reserva Ipê. Devolução em dobro deferida: R$ 54.300.',
        caso_id: 'caso-005',
        caso_snapshot: {
          id: 'caso-005',
          cliente: 'Helena Costa',
          empreendimento: 'Reserva Ipê',
          status: 'Ajuizado',
          excesso: 27150,
        },
        restrito_a_socios: false,
        criado_em: new Date(agora - 5 * hora).toISOString(),
      },
      {
        id: 'post-3',
        tipo: 'usuario',
        autor_id: IDS.lucas,
        texto: TEXTO_3,
        restrito_a_socios: false,
        criado_em: ontem.toISOString(),
      },
    ])
    if (error) throw error
  }
  {
    const { error } = await admin.from('post_mencoes').insert([
      { post_id: 'post-1', usuario_id: IDS.vitor, offset_start: 0, length: 6 },
      {
        post_id: 'post-3',
        usuario_id: 'todos',
        offset_start: TEXTO_3.indexOf('@todos'),
        length: 6,
      },
    ])
    if (error) throw error
  }
  {
    const { error } = await admin.from('comentarios').insert([
      {
        id: 'c-1-1',
        post_id: 'post-1',
        autor_id: IDS.vitor,
        texto: 'Mesma tese no caso Costa. O juiz não acolheu — mando a sentença ainda hoje.',
        criado_em: new Date(agora - 1.2 * hora).toISOString(),
      },
    ])
    if (error) throw error
  }
  {
    const { error } = await admin.from('marcacoes').insert([
      {
        id: 'marc-1',
        post_id: 'post-1',
        destinatario_id: IDS.vitor,
        autor_id: IDS.rafaela,
        resumo: 'sobre a defesa da Kallas',
        lida: false,
      },
      {
        id: 'marc-2',
        post_id: 'post-3',
        destinatario_id: IDS.helena,
        autor_id: IDS.lucas,
        resumo: 'sobre a revisão do ICP',
        lida: false,
      },
      {
        id: 'marc-3',
        post_id: 'post-1',
        destinatario_id: IDS.helena,
        autor_id: IDS.rafaela,
        resumo: 'sobre a defesa da Kallas',
        lida: false,
      },
    ])
    if (error) throw error
  }

  console.log('Inserindo materiais + atenção…')
  {
    const { error } = await admin.from('materiais').insert([
      {
        id: 'mat-001',
        nome: 'Carta ao comprador',
        descricao:
          'Primeiro contato com o comprador de imóvel na planta. Explica a regra dos 36 meses e oferece a análise gratuita.',
        categoria: 'comercial',
        formato: 'docx',
        thumb: 'carta',
        tamanho_bytes: 48 * 1024,
        url: '#',
        atualizado_em: '2026-08-10T09:00:00-03:00',
      },
      {
        id: 'mat-002',
        nome: 'Carta ao canal de originação',
        descricao:
          'Proposta de parceria para corretores, síndicos e assessorias. Use na primeira abordagem de um canal novo.',
        categoria: 'comercial',
        formato: 'docx',
        thumb: 'carta-bloco',
        tamanho_bytes: 46 * 1024,
        url: '#',
        atualizado_em: '2026-08-09T11:20:00-03:00',
      },
      {
        id: 'mat-003',
        nome: 'ICP — Perfil de cliente ideal',
        descricao: 'Critérios de aceite e recusa de casos. Consulte antes de aprovar um contrato na triagem.',
        categoria: 'operacional',
        formato: 'docx',
        thumb: 'tabela',
        tamanho_bytes: 52 * 1024,
        url: '#',
        atualizado_em: '2026-08-08T14:40:00-03:00',
      },
      {
        id: 'mat-004',
        nome: 'Cartão de qualificação',
        descricao:
          'Cinco perguntas para o parceiro qualificar um caso sem entender a tese. Entregue impresso na reunião.',
        categoria: 'comercial',
        formato: 'pdf',
        thumb: 'checklist',
        tamanho_bytes: 120 * 1024,
        url: '#',
        atualizado_em: '2026-08-07T16:15:00-03:00',
      },
      {
        id: 'mat-005',
        nome: 'Pedido de memorial à incorporadora',
        descricao:
          'Modelo para o cliente solicitar o memorial de cálculo. Envie quando ele não localizar o documento.',
        categoria: 'operacional',
        formato: 'docx',
        thumb: 'memorando',
        tamanho_bytes: 32 * 1024,
        url: '#',
        atualizado_em: '2026-08-06T10:05:00-03:00',
      },
      {
        id: 'mat-006',
        nome: 'Tese jurídica — resumo',
        descricao:
          'Fundamentos dos arts. 46 e 47 e precedentes do TJSP. Base para a inicial e para reunião com escritório.',
        categoria: 'juridico',
        formato: 'pdf',
        thumb: 'relatorio',
        tamanho_bytes: 210 * 1024,
        url: '#',
        atualizado_em: '2026-08-05T08:30:00-03:00',
      },
    ])
    if (error) throw error
  }
  {
    const { error } = await admin.from('itens_atencao').insert([
      { id: 'at-revisao', tipo: 'revisao', quantidade: 3, href: '/casos?atencao=revisao' },
      {
        id: 'at-prescricao',
        tipo: 'prescricao',
        cliente: 'Ribeiro',
        meses: 4,
        href: '/casos/caso-003',
      },
      { id: 'at-memorial', tipo: 'memorial', quantidade: 2, href: '/casos?atencao=memorial' },
    ])
    if (error) throw error
  }

  console.log('\nSeed concluído.')
  console.log('Login: admin@admin.com / 123456')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
