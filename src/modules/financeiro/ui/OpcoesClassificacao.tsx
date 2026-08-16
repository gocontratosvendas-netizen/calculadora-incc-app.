import type { Classificacao, GrupoDRE, Movimentacao } from '../types'

const ROTULO: Record<string, string> = {
  receita_bruta: 'Receita',
  imposto_sobre_receita: 'Impostos sobre receita',
  custo_direto: 'Custo direto',
  despesa_operacional: 'Despesa operacional',
  depreciacao: 'Depreciação',
  resultado_financeiro: 'Resultado financeiro',
  ir_csll: 'IR / CSLL',
  caixa: 'Fora da DRE (aporte / funding)',
}

const ORDEM: readonly string[] = [
  'receita_bruta',
  'imposto_sobre_receita',
  'custo_direto',
  'despesa_operacional',
  'depreciacao',
  'resultado_financeiro',
  'ir_csll',
  'caixa',
]

function chaveGrupo(grupo: GrupoDRE | null) {
  return grupo ?? 'caixa'
}

export function OpcoesClassificacao({
  classificacoes,
  movimentacao,
  incluirId,
  placeholder = 'Selecionar',
}: {
  classificacoes: Classificacao[]
  movimentacao: Movimentacao
  incluirId?: string
  placeholder?: string
}) {
  const lista = classificacoes.filter(
    (c) => c.movimentacao === movimentacao && (c.ativa || c.id === incluirId),
  )
  const buckets = new Map<string, Classificacao[]>()
  for (const c of lista) {
    const k = chaveGrupo(c.grupoDRE)
    const grupo = buckets.get(k) ?? []
    grupo.push(c)
    buckets.set(k, grupo)
  }

  return (
    <>
      <option value="">{placeholder}</option>
      {ORDEM.filter((k) => buckets.has(k)).map((k) => (
        <optgroup key={k} label={ROTULO[k] ?? k}>
          {(buckets.get(k) ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.nome}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
