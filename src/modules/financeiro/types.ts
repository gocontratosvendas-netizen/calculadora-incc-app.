export type Movimentacao = 'entrada' | 'saida'

export type StatusLancamento = 'pago' | 'pendente' | 'atrasado'

export type Regime = 'competencia' | 'caixa'

export type AcaoAuditoria = 'criar' | 'editar' | 'excluir' | 'liquidar'

export type GrupoDRE =
  | 'receita_bruta'
  | 'imposto_sobre_receita'
  | 'custo_direto'
  | 'despesa_operacional'
  | 'depreciacao'
  | 'resultado_financeiro'
  | 'ir_csll'

export interface Lancamento {
  id: string
  dataEmissao: string
  movimentacao: Movimentacao
  historico: string
  classificacaoId: string
  /** Centavos, inteiro, sempre > 0. O sinal vem de `movimentacao`. */
  valor: number
  vencimento: string
  dataPagamento: string | null
  casoId?: string
  observacao?: string
  deletadoEm: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface Classificacao {
  id: string
  codigo: string
  nome: string
  movimentacao: Movimentacao
  /** `null` = movimento de caixa que não entra na DRE (aporte, funding). */
  grupoDRE: GrupoDRE | null
  ordem: number
  ativa: boolean
  sistema: boolean
}

export interface LinhaDRE {
  rotulo: string
  valor: number
  /** Razão sobre a receita bruta do período (0.25 = 25%). */
  analiseVertical: number
  valorAnterior: number
  /** `null` quando o período anterior é zero — exibir "—". */
  variacao: number | null
  nivel: 'total' | 'subtotal' | 'detalhe'
  destaque?: boolean
  chave: string
  sentido: 'resultado' | 'despesa'
  classificacaoId?: string
  grupoDRE?: GrupoDRE
}

export interface Periodo {
  inicio: string
  fim: string
}

export interface ResultadoDRE {
  receitaBruta: number
  impostosSobreReceita: number
  receitaLiquida: number
  custosDiretos: number
  lucroBruto: number
  despesasOperacionais: number
  ebitda: number
  depreciacao: number
  resultadoFinanceiro: number
  irCsll: number
  lucroLiquido: number
  porClassificacao: Map<string, number>
}

export interface ResumoCaixa {
  entradas: number
  saidas: number
  saldo: number
  aReceber: number
  aPagar: number
}

export type PapelFinanceiro = 'socio' | 'financeiro' | 'outro'

export interface FinanceiroSessao {
  usuarioId: string
  papel: PapelFinanceiro
}

export type FinanceiroMountProps = {
  sessao: FinanceiroSessao
  carregarClientes?: () => Promise<ClienteLancamentoOpcao[]>
}

export type ClienteLancamentoOpcao = {
  casoId: string
  nome: string
  detalhe?: string
}

export interface LancamentoInput {
  dataEmissao: string
  movimentacao: Movimentacao
  historico: string
  classificacaoId: string
  valor: number
  vencimento: string
  dataPagamento: string | null
  casoId?: string
  observacao?: string
}

export type SortCampo =
  | 'emissao'
  | 'movimentacao'
  | 'historico'
  | 'classificacao'
  | 'valor'
  | 'vencimento'
  | 'pagamento'

export type SortDir = 'asc' | 'desc'
