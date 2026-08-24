import { casoEntraNaCarteiraJudicial, listarCasos, type Caso } from './casos'
import { supabase } from './supabase'

export interface DashboardSummary {
  excessoTotalCarteira: number
  contratosApurados: number
  casosAtivos: number
  casosEmCalculo: number
  valoresRecuperados: number
  casosLiquidados: number
  casosAguardandoRevisao: number
}

function fromCasos(casos: Caso[], revisao: number): DashboardSummary {
  let excessoTotalCarteira = 0
  let contratosApurados = 0
  let casosAtivos = 0
  let casosEmCalculo = 0
  let valoresRecuperados = 0
  let casosLiquidados = 0

  for (const caso of casos) {
    if (caso.status === 'processo_de_venda' && caso.excessoApurado == null) {
      casosEmCalculo += 1
    }
    if (!casoEntraNaCarteiraJudicial(caso.status)) continue
    if (caso.excessoApurado != null) {
      excessoTotalCarteira += caso.excessoApurado
      contratosApurados += 1
    }
    if (caso.status !== 'encerrado') {
      casosAtivos += 1
    }
    if (caso.status === 'encerrado') {
      casosLiquidados += 1
      if (caso.excessoApurado != null) valoresRecuperados += caso.excessoApurado
    }
  }

  return {
    excessoTotalCarteira,
    contratosApurados,
    casosAtivos,
    casosEmCalculo,
    valoresRecuperados,
    casosLiquidados,
    casosAguardandoRevisao: revisao,
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [casos, { data: atencao }] = await Promise.all([
    listarCasos(),
    supabase.from('itens_atencao').select('quantidade').eq('tipo', 'revisao').maybeSingle(),
  ])
  return fromCasos(casos, atencao?.quantidade ?? 0)
}
