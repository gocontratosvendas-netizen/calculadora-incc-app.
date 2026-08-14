export interface DashboardSummary {
  excessoTotalCarteira: number
  contratosApurados: number
  casosAtivos: number
  casosEmCalculo: number
  valoresRecuperados: number
  casosLiquidados: number
  casosAguardandoRevisao: number
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
