export type CasoStatus = 'processo_de_venda' | 'ajuizado' | 'encerrado'

export interface Caso {
  id: string
  cliente: string
  empreendimento: string
  incorporadora: string
  valorContrato: number
  excessoApurado: number | null
  valorCausa: number | null
  anoAjuizamento: number | null
  status: CasoStatus
  responsavel: { nome: string; iniciais: string }
  atualizadoEm: string
}

export interface CarteiraResumo {
  casosCadastrados: number
  emAndamento: number
  valorTotalCausa: number
  excessoTotalCarteira: number
  recuperado: number
}

const RESPONSAVEIS = {
  VP: { nome: 'Vitor Paludetto', iniciais: 'VP' },
  RM: { nome: 'Renata Martins', iniciais: 'RM' },
  LF: { nome: 'Lucas Ferreira', iniciais: 'LF' },
} as const

const CASOS: Caso[] = [
  {
    id: 'caso-001',
    cliente: 'Marcos Almeida',
    empreendimento: 'Henry Boulevard',
    incorporadora: 'Kallas',
    valorContrato: 780_000,
    excessoApurado: 23_410,
    valorCausa: null,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: '2026-08-10T09:00:00-03:00',
  },
  {
    id: 'caso-002',
    cliente: 'Erika Tanaka',
    empreendimento: 'Vila Nova 1200',
    incorporadora: 'Cyrela',
    valorContrato: 1_150_000,
    excessoApurado: 34_820,
    valorCausa: 69_640,
    anoAjuizamento: 2023,
    status: 'ajuizado',
    responsavel: RESPONSAVEIS.RM,
    atualizadoEm: '2026-08-11T11:20:00-03:00',
  },
  {
    id: 'caso-003',
    cliente: 'Paula Ribeiro',
    empreendimento: 'Parque Cidade',
    incorporadora: 'MRV',
    valorContrato: 520_000,
    excessoApurado: null,
    valorCausa: null,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: '2026-08-09T15:40:00-03:00',
  },
  {
    id: 'caso-004',
    cliente: 'Luís Moreira',
    empreendimento: 'Alto da Lapa',
    incorporadora: 'Even',
    valorContrato: 640_000,
    excessoApurado: 19_070,
    valorCausa: null,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.LF,
    atualizadoEm: '2026-08-12T08:30:00-03:00',
  },
  {
    id: 'caso-005',
    cliente: 'Helena Costa',
    empreendimento: 'Reserva Ipê',
    incorporadora: 'Kallas',
    valorContrato: 890_000,
    excessoApurado: 27_150,
    valorCausa: 54_300,
    anoAjuizamento: 2022,
    status: 'ajuizado',
    responsavel: RESPONSAVEIS.RM,
    atualizadoEm: '2026-08-13T14:10:00-03:00',
  },
  {
    id: 'caso-006',
    cliente: 'Sérgio Nakamura',
    empreendimento: 'Jardins 900',
    incorporadora: 'Tegra',
    valorContrato: 1_420_000,
    excessoApurado: 42_600,
    valorCausa: 85_200,
    anoAjuizamento: 2022,
    status: 'encerrado',
    responsavel: RESPONSAVEIS.LF,
    atualizadoEm: '2026-08-08T17:00:00-03:00',
  },
  {
    id: 'caso-007',
    cliente: 'Camila Barros',
    empreendimento: 'Vista Sul',
    incorporadora: 'MRV',
    valorContrato: 470_000,
    excessoApurado: 14_280,
    valorCausa: 28_560,
    anoAjuizamento: 2023,
    status: 'ajuizado',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: '2026-08-14T10:05:00-03:00',
  },
]

const RESUMO: CarteiraResumo = {
  casosCadastrados: 47,
  emAndamento: 18,
  valorTotalCausa: 2_410_000,
  excessoTotalCarteira: 1_240_000,
  recuperado: 312_500,
}

export async function listarCasos(): Promise<Caso[]> {
  return CASOS.map((caso) => ({ ...caso, responsavel: { ...caso.responsavel } })) // TODO: conectar ao backend
}

export async function obterResumoCarteira(): Promise<CarteiraResumo> {
  return { ...RESUMO } // TODO: conectar ao backend
}

export type NovoCasoInput = {
  cliente: string
  empreendimento?: string
  incorporadora?: string
  valorContrato: number
  excessoApurado: number | null
  valorCausa: number | null
}

export async function cadastrarCaso(input: NovoCasoInput): Promise<Caso> {
  const cliente = input.cliente.trim()
  if (!cliente) {
    throw new Error('Informe o nome do cliente')
  }

  const caso: Caso = {
    id: `caso-${Date.now()}`,
    cliente,
    empreendimento: input.empreendimento?.trim() || 'A definir',
    incorporadora: input.incorporadora?.trim() || 'A definir',
    valorContrato: input.valorContrato,
    excessoApurado: input.excessoApurado,
    valorCausa: input.valorCausa,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: new Date().toISOString(),
  }

  CASOS.unshift(caso)
  RESUMO.casosCadastrados += 1
  RESUMO.emAndamento += 1
  if (caso.excessoApurado != null && caso.excessoApurado > 0) {
    RESUMO.excessoTotalCarteira += caso.excessoApurado
  }
  if (caso.valorCausa != null) {
    RESUMO.valorTotalCausa += caso.valorCausa
  }

  return { ...caso, responsavel: { ...caso.responsavel } } // TODO: conectar ao backend
}

export async function excluirCaso(id: string): Promise<void> {
  const indice = CASOS.findIndex((caso) => caso.id === id)
  if (indice === -1) {
    throw new Error('Caso não encontrado')
  }
  const [removido] = CASOS.splice(indice, 1)
  RESUMO.casosCadastrados = Math.max(0, RESUMO.casosCadastrados - 1)
  if (removido.status === 'ajuizado' || removido.status === 'processo_de_venda') {
    RESUMO.emAndamento = Math.max(0, RESUMO.emAndamento - 1)
  }
  if (removido.valorCausa != null) {
    RESUMO.valorTotalCausa = Math.max(0, RESUMO.valorTotalCausa - removido.valorCausa)
  }
  if (removido.excessoApurado != null) {
    RESUMO.excessoTotalCarteira = Math.max(0, RESUMO.excessoTotalCarteira - removido.excessoApurado)
  }
  return // TODO: conectar ao backend
}
