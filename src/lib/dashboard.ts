export type CaseStatus =
  | 'memorial_pronto'
  | 'em_analise'
  | 'aguardando_docs'
  | 'encerrado'

export interface DashboardSummary {
  excessoTotalCarteira: number
  contratosApurados: number
  casosAtivos: number
  casosEmCalculo: number
  valoresRecuperados: number
  casosLiquidados: number
  casosAguardandoRevisao: number
}

export interface RecentCase {
  id: string
  cliente: string
  empreendimento: string
  valorContrato: number
  excessoApurado: number | null
  status: CaseStatus
  atualizadoEm: string
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return {
    excessoTotalCarteira: 1_240_000,
    contratosApurados: 47,
    casosAtivos: 18,
    casosEmCalculo: 6,
    valoresRecuperados: 312_500,
    casosLiquidados: 5,
    casosAguardandoRevisao: 3,
  } // TODO: conectar ao backend
}

export async function getRecentCases(): Promise<RecentCase[]> {
  return [
    {
      id: 'caso-001',
      cliente: 'Helena Duarte Costa',
      empreendimento: 'Residencial Jardim Europa',
      valorContrato: 890000,
      excessoApurado: 142000,
      status: 'memorial_pronto',
      atualizadoEm: '2026-08-14T10:20:00-03:00',
    },
    {
      id: 'caso-002',
      cliente: 'Ricardo Mendes',
      empreendimento: 'Edifício Aurora',
      valorContrato: 620000,
      excessoApurado: 87500,
      status: 'em_analise',
      atualizadoEm: '2026-08-13T16:40:00-03:00',
    },
    {
      id: 'caso-003',
      cliente: 'Família Albuquerque',
      empreendimento: 'Parque das Águas',
      valorContrato: 450000,
      excessoApurado: null,
      status: 'aguardando_docs',
      atualizadoEm: '2026-08-12T09:15:00-03:00',
    },
    {
      id: 'caso-004',
      cliente: 'Carla Nogueira',
      empreendimento: 'Torre Harmonia',
      valorContrato: 735000,
      excessoApurado: 51000,
      status: 'em_analise',
      atualizadoEm: '2026-08-11T14:05:00-03:00',
    },
    {
      id: 'caso-005',
      cliente: 'Paulo Henrique Barros',
      empreendimento: 'Villa das Palmeiras',
      valorContrato: 380000,
      excessoApurado: 22400,
      status: 'encerrado',
      atualizadoEm: '2026-08-08T11:30:00-03:00',
    },
  ] // TODO: conectar ao backend
}
