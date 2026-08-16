import { z } from 'zod'
import { apenasDigitos, aporteConsistente, cpfValido, dataEntradaValida, participacaoNoIntervalo, participacaoParaCentesimos } from '../autorizacao'
import { hojeISO } from '../format'
import type { SocioInput } from '../types'

const emailSchema = z.string().trim().email('E-mail inválido.')

export const socioInputSchema = z
  .object({
    nomeCompleto: z.string().trim().min(3, 'Informe o nome completo.'),
    cpf: z.string().trim().min(11, 'CPF inválido.'),
    email: emailSchema,
    telefone: z.string().trim().optional(),
    participacao: z.number().refine((n) => participacaoNoIntervalo(participacaoParaCentesimos(n)), {
      message: 'Participação deve estar entre 0,01% e 100,00%.',
    }),
    aporteComprometido: z.number().int().min(0, 'Aporte inválido.'),
    aporteIntegralizado: z.number().int().min(0, 'Aporte inválido.'),
    dataEntrada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
    observacao: z.string().optional(),
    usuarioId: z.string().uuid().nullable().optional(),
    convidarConta: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!cpfValido(data.cpf)) {
      ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'CPF inválido.' })
    }
    if (!aporteConsistente(data.aporteComprometido, data.aporteIntegralizado)) {
      ctx.addIssue({
        code: 'custom',
        path: ['aporteIntegralizado'],
        message: 'Aporte integralizado não pode exceder o comprometido.',
      })
    }
    if (!dataEntradaValida(data.dataEntrada, hojeISO())) {
      ctx.addIssue({ code: 'custom', path: ['dataEntrada'], message: 'Data de entrada não pode ser futura.' })
    }
  })

export type ErrosSocio = Partial<Record<keyof SocioInput, string>>

export function validarSocioInput(input: SocioInput): { ok: true; data: SocioInput } | { ok: false; errors: ErrosSocio } {
  const parsed = socioInputSchema.safeParse({
    ...input,
    cpf: apenasDigitos(input.cpf),
  })
  if (parsed.success) return { ok: true, data: parsed.data as SocioInput }
  const errors: ErrosSocio = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as keyof SocioInput] = issue.message
    }
  }
  return { ok: false, errors }
}

export const conviteInputSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome.'),
  email: emailSchema,
  papelId: z.string().min(1, 'Selecione o papel.'),
})

export const papelNovoSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome do papel.'),
  descricao: z.string().trim().min(1, 'Informe a descrição.'),
  origemId: z.string().min(1, 'Parta de um papel existente.'),
})
