import { useEffect, useMemo, useState } from 'react'
import { ACOES_AUDITORIA } from '../autorizacao'
import { listarAuditoria } from '../data/repositorio'
import { formatarDataHora } from '../format'
import type { FiltrosAuditoria, RegistroAuditoria } from '../types'

function csvEscape(valor: string) {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

export function AuditoriaPage() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({})
  const [busca, setBusca] = useState('')
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [aberto, setAberto] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      void listarAuditoria({ ...filtros, busca }).then((result) => {
        if (result.ok) setRegistros(result.data)
      })
    }, 200)
    return () => window.clearTimeout(t)
  }, [filtros, busca])

  const autores = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of registros) map.set(r.autorId, r.autorNome)
    return [...map.entries()]
  }, [registros])

  function exportar() {
    const linhas = [
      ['criadoEm', 'autor', 'acao', 'modulo', 'entidade', 'descricao', 'ip'].join(','),
      ...registros.map((r) =>
        [r.criadoEm, r.autorNome, r.acao, r.modulo, r.entidade, r.descricao, r.ip ?? ''].map(csvEscape).join(','),
      ),
    ]
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'auditoria-verum.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="cfg-toolbar">
        <select aria-label="Autor" value={filtros.autorId ?? ''} onChange={(e) => setFiltros({ ...filtros, autorId: e.target.value || undefined })}>
          <option value="">Todos os autores</option>
          {autores.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <select aria-label="Ação" value={filtros.acao ?? ''} onChange={(e) => setFiltros({ ...filtros, acao: (e.target.value || undefined) as FiltrosAuditoria['acao'] })}>
          <option value="">Todas as ações</option>
          {ACOES_AUDITORIA.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input placeholder="Módulo" aria-label="Módulo" value={filtros.modulo ?? ''} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value || undefined })} />
        <input placeholder="Entidade" aria-label="Entidade" value={filtros.entidade ?? ''} onChange={(e) => setFiltros({ ...filtros, entidade: e.target.value || undefined })} />
        <input type="date" aria-label="De" value={filtros.de?.slice(0, 10) ?? ''} onChange={(e) => setFiltros({ ...filtros, de: e.target.value ? `${e.target.value}T00:00:00` : undefined })} />
        <input type="date" aria-label="Até" value={filtros.ate?.slice(0, 10) ?? ''} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value ? `${e.target.value}T23:59:59` : undefined })} />
        <input placeholder="Buscar" aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="cfg-toolbar-right">
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={exportar} disabled={registros.length === 0}>
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="cfg-table-wrap">
        <table className="cfg-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Autor</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id} className="cfg-audit-row" onClick={() => setAberto(aberto === r.id ? null : r.id)}>
                <td className="cfg-audit-time">{formatarDataHora(r.criadoEm)}</td>
                <td>{r.autorNome}</td>
                <td>
                  {r.descricao}
                  {aberto === r.id ? (
                    <div className="cfg-diff">
                      <div>
                        <strong>Anterior:</strong> {r.valorAnterior ? JSON.stringify(r.valorAnterior, null, 2) : '—'}
                      </div>
                      <div>
                        <strong>Novo:</strong> {r.valorNovo ? JSON.stringify(r.valorNovo, null, 2) : '—'}
                      </div>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
