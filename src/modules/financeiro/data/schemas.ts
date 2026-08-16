import { z } from 'zod'
import type { LancamentoInput } from '../types'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

export const lancamentoInputSchema = z
  .object({
    dataEmissao: isoDate,
    movimentacao: z.enum(['entrada', 'saida']),
    historico: z
      .string()
      .trim()
      .min(3, 'Histórico deve ter entre 3 e 120 caracteres.')
      .max(120, 'Histórico deve ter entre 3 e 120 caracteres.'),
    classificacaoId: z.string().min(1, 'Selecione uma classificação.'),
    valor: z.number().int('Informe um valor maior que zero.').positive('Informe um valor maior que zero.'),
    vencimento: isoDate,
    dataPagamento: isoDate.nullable(),
    casoId: z.string().min(1).optional(),
    observacao: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.vencimento < data.dataEmissao) {
      ctx.addIssue({
        code: 'custom',
        path: ['vencimento'],
        message: 'Vencimento não pode ser anterior à emissão.',
      })
    }
    if (data.dataPagamento && data.dataPagamento < data.dataEmissao) {
      ctx.addIssue({
        code: 'custom',
        path: ['dataPagamento'],
        message: 'Pagamento não pode ser anterior à emissão.',
      })
    }
  })

export type CampoLancamento =
  | 'dataEmissao'
  | 'movimentacao'
  | 'historico'
  | 'classificacaoId'
  | 'valor'
  | 'vencimento'
  | 'dataPagamento'

export type ErrosLancamento = Partial<Record<CampoLancamento, string>>

export function validarLancamentoInput(input: LancamentoInput): {
  ok: true
  data: LancamentoInput
} | {
  ok: false
  errors: ErrosLancamento
} {
  const parsed = lancamentoInputSchema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data as LancamentoInput }
  const errors: ErrosLancamento = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as CampoLancamento] = issue.message
    }
  }
  return { ok: false, errors }
}

export const ORDEM_CAMPOS: CampoLancamento[] = [
  'dataEmissao',
  'movimentacao',
  'historico',
  'classificacaoId',
  'valor',
  'vencimento',
  'dataPagamento',
]
