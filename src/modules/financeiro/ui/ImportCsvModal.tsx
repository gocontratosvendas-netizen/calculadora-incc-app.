import { useMemo, useState } from 'react'
import { parseCsv, normalizarTexto } from '../data/csv'
import { parseMoedaParaCentavos } from '../data/moeda'
import { validarLancamentoInput } from '../data/schemas'
import type { Classificacao, LancamentoInput, Movimentacao } from '../types'

const CAMPOS = [
  { id: 'dataEmissao', rotulo: 'Data de emissão' },
  { id: 'movimentacao', rotulo: 'Movimentação' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'classificacao', rotulo: 'Classificação' },
  { id: 'valor', rotulo: 'Valor' },
  { id: 'vencimento', rotulo: 'Vencimento' },
  { id: 'dataPagamento', rotulo: 'Pagamento' },
] as const

type CampoId = (typeof CAMPOS)[number]['id']

type LinhaOk = { linha: number; input: LancamentoInput }
type LinhaErro = { linha: number; erro: string }

function parseData(valor: string): string | null {
  const t = valor.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const m2 = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(t)
  if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`
  return null
}

function parseMov(valor: string): Movimentacao | null {
  const n = normalizarTexto(valor)
  if (n.startsWith('ent')) return 'entrada'
  if (n.startsWith('sai')) return 'saida'
  return null
}

function resolverClassificacao(valor: string, classificacoes: Classificacao[]): Classificacao | null {
  const n = normalizarTexto(valor)
  return (
    classificacoes.find((c) => c.codigo.toLowerCase() === n) ??
    classificacoes.find((c) => normalizarTexto(c.nome) === n) ??
    null
  )
}

function sugerirMapeamento(headers: string[]): Record<CampoId, number> {
  const map = {} as Record<CampoId, number>
  for (const campo of CAMPOS) map[campo.id] = -1
  headers.forEach((h, i) => {
    const n = normalizarTexto(h)
    if (n.includes('emiss')) map.dataEmissao = i
    else if (n.startsWith('mov')) map.movimentacao = i
    else if (n.includes('histor')) map.historico = i
    else if (n.includes('classif')) map.classificacao = i
    else if (n.includes('valor')) map.valor = i
    else if (n.includes('venc')) map.vencimento = i
    else if (n.includes('pag')) map.dataPagamento = i
  })
  return map
}

type Props = {
  open: boolean
  classificacoes: Classificacao[]
  onClose: () => void
  onConfirmar: (inputs: LancamentoInput[]) => Promise<void>
}

export function ImportCsvModal({ open, classificacoes, onClose, onConfirmar }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [map, setMap] = useState<Record<CampoId, number>>({
    dataEmissao: -1,
    movimentacao: -1,
    historico: -1,
    classificacao: -1,
    valor: -1,
    vencimento: -1,
    dataPagamento: -1,
  })
  const [enviando, setEnviando] = useState(false)

  const validacao = useMemo(() => {
    const oks: LinhaOk[] = []
    const erros: LinhaErro[] = []
    rows.forEach((row, idx) => {
      const linha = idx + 2
      const get = (campo: CampoId) => (map[campo] >= 0 ? (row[map[campo]] ?? '') : '')
      if (!get('historico') && !get('valor')) return
      const dataEmissao = parseData(get('dataEmissao'))
      const vencimento = parseData(get('vencimento')) ?? dataEmissao
      const pagRaw = get('dataPagamento')
      const dataPagamento = pagRaw ? parseData(pagRaw) : null
      const mov = parseMov(get('movimentacao'))
      const classif = resolverClassificacao(get('classificacao'), classificacoes)
      const valor = parseMoedaParaCentavos(get('valor').replace(/^-/, ''))
      if (!classif) {
        erros.push({ linha, erro: `Classificação desconhecida: “${get('classificacao')}”. Nenhuma conta nova foi criada.` })
        return
      }
      if (!dataEmissao || !vencimento || !mov || valor === null) {
        erros.push({ linha, erro: 'Campos obrigatórios ausentes ou inválidos.' })
        return
      }
      const input: LancamentoInput = {
        dataEmissao,
        movimentacao: mov,
        historico: get('historico'),
        classificacaoId: classif.id,
        valor,
        vencimento,
        dataPagamento,
      }
      const parsed = validarLancamentoInput(input)
      if (!parsed.ok) {
        erros.push({ linha, erro: Object.values(parsed.errors).join(' ') })
        return
      }
      oks.push({ linha, input: parsed.data })
    })
    return { oks, erros }
  }, [rows, map, classificacoes])

  if (!open) return null

  return (
    <div className="fin-backdrop" onClick={onClose}>
      <div className="fin-panel" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Importar CSV</h2>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const texto = await file.text()
            const parsed = parseCsv(texto)
            setHeaders(parsed.headers)
            setRows(parsed.rows)
            setMap(sugerirMapeamento(parsed.headers))
          }}
        />
        {headers.length > 0 ? (
          <>
            <p className="fin-header-sub">Mapeie as colunas do arquivo.</p>
            {CAMPOS.map((campo) => (
              <div key={campo.id} className="fin-field" style={{ marginTop: 6 }}>
                <label>{campo.rotulo}</label>
                <select
                  className="fin-select"
                  value={map[campo.id]}
                  onChange={(e) => setMap({ ...map, [campo.id]: Number(e.target.value) })}
                >
                  <option value={-1}>—</option>
                  {headers.map((h, i) => (
                    <option key={h + i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="fin-header-sub" style={{ marginTop: 12 }}>
              Pré-visualização (10 primeiras linhas)
            </p>
            <div className="fin-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {headers.map((_, j) => (
                        <td key={j}>{row[j]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validacao.erros.length > 0 ? (
              <ul className="fin-field-erro" style={{ marginTop: 12 }}>
                {validacao.erros.slice(0, 20).map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha}: {e.erro}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fin-header-sub">{validacao.oks.length} linha(s) pronta(s).</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="fin-btn fin-btn--secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="fin-btn fin-btn--primary"
                disabled={enviando || validacao.oks.length === 0 || validacao.erros.length > 0}
                onClick={() => {
                  setEnviando(true)
                  void onConfirmar(validacao.oks.map((o) => o.input)).finally(() => setEnviando(false))
                }}
              >
                {enviando ? 'Importando…' : 'Confirmar importação'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
