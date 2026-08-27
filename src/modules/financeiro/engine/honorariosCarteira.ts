import { resumirProLaboreDoCaso, type ProLaboreDoCaso } from './somarProLaboreRecebido'

export type HonorarioDoCaso = ProLaboreDoCaso

export type HonorariosDoCaso = {
  proLabore: HonorarioDoCaso
  exito: HonorarioDoCaso
}

export type SituacaoHonorario = 'recebido' | 'parcial' | 'nao_recebido'

export type HonorarioCarteiraItem = {
  casoId?: string
  proLaborePago?: number
  proLaborePendente?: number
  exitoPago?: number
  exitoPendente?: number
}

export function honorariosVazio(): HonorariosDoCaso {
  const vazio = resumirProLaboreDoCaso(0, 0)
  return { proLabore: vazio, exito: vazio }
}

export function mapearHonorariosDaCarteira(
  itens: HonorarioCarteiraItem[] | null | undefined,
): Record<string, HonorariosDoCaso> {
  const out: Record<string, HonorariosDoCaso> = {}
  for (const item of itens ?? []) {
    if (!item.casoId) continue
    out[item.casoId] = {
      proLabore: resumirProLaboreDoCaso(
        Number(item.proLaborePago ?? 0),
        Number(item.proLaborePendente ?? 0),
      ),
      exito: resumirProLaboreDoCaso(Number(item.exitoPago ?? 0), Number(item.exitoPendente ?? 0)),
    }
  }
  return out
}

export function situacaoHonorario(resumo: HonorarioDoCaso | undefined): SituacaoHonorario {
  if (!resumo) return 'nao_recebido'
  if (resumo.status === 'pago') return 'recebido'
  if (resumo.valorPago > 0) return 'parcial'
  return 'nao_recebido'
}

export function rotuloSituacaoHonorario(situacao: SituacaoHonorario): string {
  if (situacao === 'recebido') return 'Recebido'
  if (situacao === 'parcial') return 'Parcial'
  return 'Não recebido'
}

/** Valor a exibir: pago se houver, senão pendente, senão o fallback (êxito esperado). */
export function valorHonorarioExibido(
  resumo: HonorarioDoCaso | undefined,
  fallback: number | null = null,
): number | null {
  if (resumo && resumo.valorPago > 0) return resumo.valorPago
  if (resumo && resumo.valorPendente > 0) return resumo.valorPendente
  return fallback
}

export function valorHonorarioRecebido(resumo: HonorarioDoCaso | undefined): number {
  return resumo?.valorPago ?? 0
}
