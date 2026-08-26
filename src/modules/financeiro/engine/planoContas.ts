import type { Classificacao } from '../types'

type Seed = Omit<Classificacao, 'ativa' | 'sistema'>

/** Receita de pró-labore (ajuizamento). Distinta de 4.02.002 (despesa de pessoal). */
export const CLASSIFICACAO_PRO_LABORE_RECEITA = '3.01.005'

const SEED: readonly Seed[] = [
  { id: '3.01.001', codigo: '3.01.001', nome: 'Cessão de crédito', movimentacao: 'entrada', grupoDRE: 'receita_bruta', ordem: 101 },
  { id: '3.01.002', codigo: '3.01.002', nome: 'Honorários de êxito', movimentacao: 'entrada', grupoDRE: 'receita_bruta', ordem: 102 },
  { id: '3.01.003', codigo: '3.01.003', nome: 'Upside CDC (dobro)', movimentacao: 'entrada', grupoDRE: 'receita_bruta', ordem: 103 },
  { id: '3.01.004', codigo: '3.01.004', nome: 'Outras receitas', movimentacao: 'entrada', grupoDRE: 'receita_bruta', ordem: 104 },
  { id: CLASSIFICACAO_PRO_LABORE_RECEITA, codigo: CLASSIFICACAO_PRO_LABORE_RECEITA, nome: 'Pró-labore', movimentacao: 'entrada', grupoDRE: 'receita_bruta', ordem: 105 },
  { id: '3.02.001', codigo: '3.02.001', nome: 'Aporte de sócios', movimentacao: 'entrada', grupoDRE: null, ordem: 201 },
  { id: '3.02.002', codigo: '3.02.002', nome: 'Empréstimo / funding', movimentacao: 'entrada', grupoDRE: null, ordem: 202 },
  { id: '4.01.001', codigo: '4.01.001', nome: 'Honorários escritório parceiro', movimentacao: 'saida', grupoDRE: 'custo_direto', ordem: 301 },
  { id: '4.01.002', codigo: '4.01.002', nome: 'Custas e despesas processuais', movimentacao: 'saida', grupoDRE: 'custo_direto', ordem: 302 },
  { id: '4.01.003', codigo: '4.01.003', nome: 'Perícia e cálculos', movimentacao: 'saida', grupoDRE: 'custo_direto', ordem: 303 },
  { id: '4.01.004', codigo: '4.01.004', nome: 'Comissão de originação', movimentacao: 'saida', grupoDRE: 'custo_direto', ordem: 304 },
  { id: '4.01.005', codigo: '4.01.005', nome: 'Deságio na cessão', movimentacao: 'saida', grupoDRE: 'custo_direto', ordem: 305 },
  { id: '4.02.001', codigo: '4.02.001', nome: 'Marketing e originação', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 401 },
  { id: '4.02.002', codigo: '4.02.002', nome: 'Pessoal e pró-labore', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 402 },
  { id: '4.02.003', codigo: '4.02.003', nome: 'Tecnologia e infraestrutura', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 403 },
  { id: '4.02.004', codigo: '4.02.004', nome: 'Administrativo e contábil', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 404 },
  { id: '4.02.005', codigo: '4.02.005', nome: 'Jurídico e societário', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 405 },
  { id: '4.02.006', codigo: '4.02.006', nome: 'Ocupação e utilidades', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 406 },
  { id: '4.02.007', codigo: '4.02.007', nome: 'Viagens e representação', movimentacao: 'saida', grupoDRE: 'despesa_operacional', ordem: 407 },
  { id: '4.03.001', codigo: '4.03.001', nome: 'Impostos sobre receita', movimentacao: 'saida', grupoDRE: 'imposto_sobre_receita', ordem: 501 },
  { id: '4.03.002', codigo: '4.03.002', nome: 'Despesas bancárias e financeiras', movimentacao: 'saida', grupoDRE: 'resultado_financeiro', ordem: 502 },
  { id: '4.03.003', codigo: '4.03.003', nome: 'Juros e encargos', movimentacao: 'saida', grupoDRE: 'resultado_financeiro', ordem: 503 },
  { id: '4.03.004', codigo: '4.03.004', nome: 'Depreciação e amortização', movimentacao: 'saida', grupoDRE: 'depreciacao', ordem: 504 },
  { id: '4.03.005', codigo: '4.03.005', nome: 'IRPJ e CSLL', movimentacao: 'saida', grupoDRE: 'ir_csll', ordem: 505 },
]

export function planoContasSeed(): Classificacao[] {
  return SEED.map((c) => ({ ...c, ativa: true, sistema: true }))
}

/** Contas de sistema sempre presentes; extras persistidas (não-sistema) entram por id. */
export function mesclarPlanoContas(persistidas: Classificacao[]): Classificacao[] {
  const byId = new Map(planoContasSeed().map((c) => [c.id, c]))
  for (const c of persistidas) byId.set(c.id, c)
  return [...byId.values()].sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo))
}

export function classificacaoPorCodigo(
  classificacoes: Classificacao[],
  codigo: string,
): Classificacao | undefined {
  return classificacoes.find((c) => c.codigo === codigo)
}
