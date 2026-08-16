import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  acoesVisiveisSocio,
  CEM_POR_CENTO,
  confirmacaoComContexto,
  desvioParticipacao,
  podeAcessarMapa,
  podeEditarCampoSocio,
} from '../autorizacao'
import { validarSocioInput } from '../data/schemas'
import { despejarFilaEmails } from '../data/email'
import {
  criarSocio,
  editarSocio,
  excluirSocio,
  listarSocios,
  registrarSaida,
  reverterSaida,
} from '../data/repositorio'
import { formatarData, formatarMoeda, formatarParticipacao, hojeISO, iniciaisDe } from '../format'
import type { Socio, SocioInput, UsuarioSessao } from '../types'
import { ReauthDialog } from './ReauthDialog'

type Props = { sessao: UsuarioSessao }

const VAZIO: SocioInput = {
  nomeCompleto: '',
  cpf: '',
  email: '',
  telefone: '',
  participacao: 0,
  aporteComprometido: 0,
  aporteIntegralizado: 0,
  dataEntrada: hojeISO(),
  observacao: '',
  convidarConta: true,
}

function reaisParaCentavos(texto: string): number {
  const n = Number(texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}

function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function IconPencil() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13l.8-3.2L11.5 2.1a1.2 1.2 0 0 1 1.7 0l.7.7a1.2 1.2 0 0 1 0 1.7L5.2 13.2 3 13Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3H3.6A1.1 1.1 0 0 0 2.5 4.1v7.8A1.1 1.1 0 0 0 3.6 13H6M7 8h6.2M10.7 5.5 13.5 8l-2.8 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5h10M6 4.5V3.2A1.2 1.2 0 0 1 7.2 2h1.6A1.2 1.2 0 0 1 10 3.2v1.3M5 4.5l.5 8.2A1 1 0 0 0 6.5 13.5h3a1 1 0 0 0 1-.8L11 4.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export function SociosPage({ sessao }: Props) {
  const [socios, setSocios] = useState<Socio[]>([])
  const [resumo, setResumo] = useState({ ativos: 0, participacaoCentesimos: 0, aportado: 0, pendente: 0 })
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [painel, setPainel] = useState<'novo' | Socio | null>(null)
  const [saida, setSaida] = useState<Socio | null>(null)
  const [excluir, setExcluir] = useState<Socio | null>(null)
  const [reauthPend, setReauthPend] = useState<(() => void) | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const perm = podeAcessarMapa(sessao.permissoes, 'configuracoes.socios', 'total')
    ? 'total'
    : podeAcessarMapa(sessao.permissoes, 'configuracoes.socios', 'editar')
      ? 'editar'
      : 'ler'

  async function recarregar(incluir = mostrarInativos) {
    const result = await listarSocios(incluir)
    if (result.ok) {
      setSocios(result.data.socios)
      setResumo(result.data.resumo)
    } else if (result.code === 'forbidden') {
      setErro('Acesso restrito.')
    }
  }

  useEffect(() => {
    let cancelled = false
    void listarSocios(mostrarInativos).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setSocios(result.data.socios)
        setResumo(result.data.resumo)
      } else if (result.code === 'forbidden') {
        setErro('Acesso restrito.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [mostrarInativos])

  const desvio = desvioParticipacao(resumo.participacaoCentesimos)
  const alertaParticipacao = !desvio.fecha
  const alertaAporte = resumo.pendente > 0

  const quadroResumo = useMemo(
    () =>
      socios.map((s) => ({
        id: s.id,
        usuarioId: s.usuarioId,
        participacaoCentesimos: Math.round(s.participacao * 100),
        aporteComprometido: s.aporteComprometido,
        aporteIntegralizado: s.aporteIntegralizado,
        dataSaida: s.dataSaida,
        deletadoEm: s.deletadoEm,
        usuarioJaLogou: false,
        temLancamentoFinanceiro: false,
      })),
    [socios],
  )

  function destacar(id: string) {
    setFlashId(id)
    window.setTimeout(() => setFlashId(null), 1500)
  }

  return (
    <>
      <section className="cfg-kpis" aria-label="Resumo do quadro">
        <div className="cfg-kpi">
          <span className="cfg-kpi-label">SÓCIOS ATIVOS</span>
          <span className="cfg-kpi-value">{resumo.ativos}</span>
        </div>
        <div className="cfg-kpi">
          <span className="cfg-kpi-label">PARTICIPAÇÃO</span>
          <span className={`cfg-kpi-value ${desvio.fecha ? 'is-ok' : 'is-warn'}`}>
            {formatarParticipacao(resumo.participacaoCentesimos / 100)}
          </span>
          {!desvio.fecha ? (
            <span className="cfg-kpi-hint">
              {desvio.desvio < 0
                ? `${formatarParticipacao(resumo.participacaoCentesimos / 100)} — faltam ${formatarParticipacao(Math.abs(desvio.desvio) / 100)}`
                : `excede ${formatarParticipacao(desvio.desvio / 100)}`}
            </span>
          ) : null}
        </div>
        <div className="cfg-kpi">
          <span className="cfg-kpi-label">APORTADO</span>
          <span className="cfg-kpi-value">{formatarMoeda(resumo.aportado)}</span>
        </div>
        <div className="cfg-kpi">
          <span className="cfg-kpi-label">PENDENTE</span>
          <span className={`cfg-kpi-value ${resumo.pendente > 0 ? 'is-warn' : ''}`}>{formatarMoeda(resumo.pendente)}</span>
        </div>
      </section>

      <div className="cfg-toolbar">
        <label className="cfg-check">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />
          Mostrar sócios que saíram
        </label>
        <div className="cfg-toolbar-right">
          {perm === 'total' ? (
            <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => setPainel('novo')}>
              Novo sócio
            </button>
          ) : null}
        </div>
      </div>

      <div className="cfg-table-wrap">
        <table className="cfg-table">
          <thead>
            <tr>
              <th>Sócio</th>
              <th className="is-right">Particip.</th>
              <th className="is-right">Aporte</th>
              <th>Entrada</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {socios.map((s) => {
              const acoes = acoesVisiveisSocio({
                permissao: perm,
                socio: quadroResumo.find((q) => q.id === s.id) ?? quadroResumo[0],
                quadro: quadroResumo,
              })
              const pendenteAporte = s.aporteIntegralizado < s.aporteComprometido && !s.dataSaida
              return (
                <tr key={s.id} className={`${s.dataSaida ? 'is-inativo' : ''} ${flashId === s.id ? 'cfg-row--flash' : ''}`.trim()}>
                  <td>
                    <span className="cfg-person">
                      <span className="cfg-avatar">{iniciaisDe(s.nomeCompleto)}</span>
                      <span className="cfg-nome">{s.nomeCompleto}</span>
                    </span>
                  </td>
                  <td className="is-num">{formatarParticipacao(s.participacao)}</td>
                  <td className={`is-num ${pendenteAporte ? 'cfg-amber' : ''}`}>
                    {pendenteAporte
                      ? `${formatarMoeda(s.aporteIntegralizado)} de ${formatarMoeda(s.aporteComprometido)}`
                      : formatarMoeda(s.aporteIntegralizado)}
                  </td>
                  <td>{formatarData(s.dataEntrada)}</td>
                  <td>
                    {s.dataSaida ? (
                      <span className="cfg-badge cfg-badge--inativo">Saiu em {formatarData(s.dataSaida)}</span>
                    ) : (
                      <span className={`cfg-badge cfg-badge--${s.situacao}`}>
                        {s.situacao === 'aporte_pendente' ? 'Aporte pendente' : 'Ativo'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="cfg-row-actions">
                      {acoes.includes('editar') ? (
                        <button type="button" className="cfg-icon-btn" aria-label={`Editar ${s.nomeCompleto}`} onClick={() => setPainel(s)}>
                          <IconPencil />
                        </button>
                      ) : null}
                      {acoes.includes('registrar_saida') ? (
                        <button type="button" className="cfg-icon-btn" aria-label={`Registrar saída de ${s.nomeCompleto}`} onClick={() => setSaida(s)}>
                          <IconLogout />
                        </button>
                      ) : null}
                      {acoes.includes('reverter_saida') ? (
                        <button
                          type="button"
                          className="cfg-icon-btn"
                          aria-label={`Reverter saída de ${s.nomeCompleto}`}
                          onClick={() => {
                            void (async () => {
                              const result = await reverterSaida(s.id)
                              if (!result.ok) {
                                setErro(result.message ?? 'Não foi possível reverter.')
                                return
                              }
                              await recarregar()
                              destacar(s.id)
                            })()
                          }}
                        >
                          <IconLogout />
                        </button>
                      ) : null}
                      {acoes.includes('excluir') ? (
                        <button type="button" className="cfg-icon-btn is-danger" aria-label={`Excluir cadastro de ${s.nomeCompleto}`} onClick={() => setExcluir(s)}>
                          <IconTrash />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="is-num">{formatarParticipacao(resumo.participacaoCentesimos / 100)}</td>
              <td className="is-num">{formatarMoeda(resumo.aportado)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
      {alertaParticipacao || alertaAporte ? (
        <div className="cfg-alert">
          {alertaParticipacao
            ? desvio.desvio < 0
              ? `A participação dos ativos soma ${formatarParticipacao(resumo.participacaoCentesimos / 100)} — faltam ${formatarParticipacao((CEM_POR_CENTO - resumo.participacaoCentesimos) / 100)}.`
              : `A participação dos ativos excede 100%.`
            : null}{' '}
          {alertaAporte ? `Há ${formatarMoeda(resumo.pendente)} de aporte pendente.` : null}
        </div>
      ) : null}
      {erro ? <p className="cfg-error-txt">{erro}</p> : null}

      {painel ? (
        <PainelSocio
          socio={painel === 'novo' ? null : painel}
          permissao={perm}
          onClose={() => setPainel(null)}
          onSaved={async (id) => {
            setPainel(null)
            await recarregar()
            destacar(id)
            void despejarFilaEmails()
          }}
          onReauth={(retry) => setReauthPend(() => retry)}
        />
      ) : null}
      {saida ? (
        <DialogoSaida
          socio={saida}
          onClose={() => setSaida(null)}
          onOk={async () => {
            setSaida(null)
            await recarregar()
            void despejarFilaEmails()
          }}
          onReauth={(retry) => setReauthPend(() => retry)}
        />
      ) : null}
      {excluir ? (
        <DialogoExcluir
          socio={excluir}
          onClose={() => setExcluir(null)}
          onSaida={() => {
            setSaida(excluir)
            setExcluir(null)
          }}
          onOk={async () => {
            setExcluir(null)
            await recarregar()
          }}
          onReauth={(retry) => setReauthPend(() => retry)}
        />
      ) : null}
      {reauthPend ? (
        <ReauthDialog
          onCancel={() => setReauthPend(null)}
          onOk={() => {
            const fn = reauthPend
            setReauthPend(null)
            fn()
          }}
        />
      ) : null}
    </>
  )
}

function PainelSocio({
  socio,
  permissao,
  onClose,
  onSaved,
  onReauth,
}: {
  socio: Socio | null
  permissao: 'ler' | 'editar' | 'total'
  onClose: () => void
  onSaved: (id: string) => void
  onReauth: (retry: () => void) => void
}) {
  const [form, setForm] = useState<SocioInput>(
    socio
      ? {
          nomeCompleto: socio.nomeCompleto,
          cpf: '',
          email: socio.email,
          telefone: socio.telefone ?? '',
          participacao: socio.participacao,
          aporteComprometido: socio.aporteComprometido,
          aporteIntegralizado: socio.aporteIntegralizado,
          dataEntrada: socio.dataEntrada,
          observacao: socio.observacao ?? '',
          usuarioId: socio.usuarioId,
          convidarConta: false,
        }
      : { ...VAZIO, dataEntrada: hojeISO() },
  )
  const [comprometidoTxt, setComprometidoTxt] = useState(socio ? centavosParaCampo(socio.aporteComprometido) : '')
  const [integTxt, setIntegTxt] = useState(socio ? centavosParaCampo(socio.aporteIntegralizado) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const total = permissao === 'total'
  const podeCampo = (campo: Parameters<typeof podeEditarCampoSocio>[1]) => podeEditarCampoSocio(permissao, campo)

  async function salvar(event: FormEvent) {
    event.preventDefault()
    const input: SocioInput = {
      ...form,
      aporteComprometido: reaisParaCentavos(comprometidoTxt),
      aporteIntegralizado: reaisParaCentavos(integTxt),
      convidarConta: socio ? false : Boolean(form.convidarConta),
    }
    const validated = validarSocioInput(input)
    if (!validated.ok) {
      setErrors(validated.errors as Record<string, string>)
      return
    }
    setBusy(true)
    const result = socio ? await editarSocio(socio.id, validated.data) : await criarSocio(validated.data)
    setBusy(false)
    if (!result.ok) {
      if (result.code === 'reauth') {
        onReauth(() => void salvar(event))
        return
      }
      setErrors(result.errors ?? {})
      if (result.message) setErrors((e) => ({ ...e, _form: result.message ?? '' }))
      return
    }
    onSaved(result.data.id)
  }

  return (
    <div className="cfg-drawer-overlay" role="presentation" onClick={onClose}>
      <div className="cfg-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="cfg-drawer-header">
          <h2>{socio ? `Editar sócio · ${socio.nomeCompleto}` : 'Novo sócio'}</h2>
          <button type="button" className="cfg-icon-btn" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={(e) => void salvar(e)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="cfg-drawer-body">
            {socio && !socio.podeExcluir ? (
              <p className="cfg-note">Este sócio tem histórico no sistema e não pode ser excluído. Use &quot;Registrar saída&quot;.</p>
            ) : null}
            <Campo label="Nome completo" value={form.nomeCompleto} disabled={!podeCampo('nomeCompleto')} error={errors.nomeCompleto} onChange={(v) => setForm({ ...form, nomeCompleto: v })} />
            <Campo
              label="CPF"
              value={form.cpf}
              placeholder={socio?.cpfMascarado}
              disabled={!podeCampo('cpf')}
              error={errors.cpf}
              onChange={(v) => setForm({ ...form, cpf: v })}
            />
            <Campo label="E-mail" value={form.email} disabled={!podeCampo('email')} error={errors.email} onChange={(v) => setForm({ ...form, email: v })} />
            {socio?.usuarioId ? (
              <p className="cfg-note">Há uma conta vinculada. Alterar o e-mail do sócio não muda o login automaticamente.</p>
            ) : null}
            <Campo label="Telefone" value={form.telefone ?? ''} disabled={!podeCampo('telefone')} onChange={(v) => setForm({ ...form, telefone: v })} />
            <Campo
              label="Participação (%)"
              value={String(form.participacao)}
              disabled={!total}
              error={errors.participacao}
              onChange={(v) => setForm({ ...form, participacao: Number(v.replace(',', '.')) || 0 })}
            />
            <Campo label="Aporte comprometido (R$)" value={comprometidoTxt} disabled={!total} error={errors.aporteComprometido} onChange={setComprometidoTxt} />
            <Campo label="Aporte integralizado (R$)" value={integTxt} disabled={!total} error={errors.aporteIntegralizado} onChange={setIntegTxt} />
            <Campo label="Data de entrada" value={form.dataEntrada} disabled={!total} error={errors.dataEntrada} onChange={(v) => setForm({ ...form, dataEntrada: v })} type="date" />
            <div className="cfg-field">
              <label>Situação</label>
              <input value={socio ? (socio.situacao === 'aporte_pendente' ? 'Aporte pendente' : socio.dataSaida ? 'Inativo' : 'Ativo') : 'Derivada automaticamente'} disabled />
            </div>
            <div className="cfg-field">
              <label htmlFor="cfg-obs">Observação</label>
              <textarea id="cfg-obs" value={form.observacao ?? ''} disabled={!podeCampo('observacao')} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            {!socio ? (
              <label className="cfg-check">
                <input type="checkbox" checked={Boolean(form.convidarConta)} onChange={(e) => setForm({ ...form, convidarConta: e.target.checked })} />
                Convidar conta de acesso com papel Sócio
              </label>
            ) : null}
            {errors._form ? <p className="cfg-error-txt">{errors._form}</p> : null}
          </div>
          <div className="cfg-drawer-footer">
            <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cfg-btn cfg-btn--primary" disabled={busy}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Campo({
  label,
  value,
  onChange,
  disabled,
  error,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  error?: string
  placeholder?: string
  type?: string
}) {
  const id = `cfg-f-${label}`
  return (
    <div className="cfg-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={error ? 'is-error' : ''} value={value} placeholder={placeholder} disabled={disabled} type={type} onChange={(e) => onChange(e.target.value)} />
      {error ? <p className="cfg-error-txt">{error}</p> : null}
    </div>
  )
}

function DialogoSaida({
  socio,
  onClose,
  onOk,
  onReauth,
}: {
  socio: Socio
  onClose: () => void
  onOk: () => void
  onReauth: (retry: () => void) => void
}) {
  const [dataSaida, setDataSaida] = useState(hojeISO())
  const [motivo, setMotivo] = useState('')
  const [suspender, setSuspender] = useState(Boolean(socio.usuarioId))
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    setBusy(true)
    const result = await registrarSaida(socio.id, { dataSaida, motivo, suspenderConta: suspender })
    setBusy(false)
    if (!result.ok) {
      if (result.code === 'reauth') {
        onReauth(() => void confirmar())
        return
      }
      setErro(result.message ?? 'Não foi possível registrar a saída.')
      return
    }
    onOk()
  }

  return (
    <div className="cfg-overlay">
      <div className="cfg-dialog" role="dialog" aria-modal="true">
        <h2>{confirmacaoComContexto(`Registrar a saída de ${socio.nomeCompleto}, com ${formatarParticipacao(socio.participacao)}`)}</h2>
        <div className="cfg-field" style={{ marginTop: 14 }}>
          <label htmlFor="cfg-saida-data">Data de saída</label>
          <input id="cfg-saida-data" type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-saida-motivo">Motivo (opcional)</label>
          <input id="cfg-saida-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        {socio.usuarioId ? (
          <label className="cfg-check">
            <input type="checkbox" checked={suspender} onChange={(e) => setSuspender(e.target.checked)} />
            Suspender a conta de acesso vinculada
          </label>
        ) : null}
        {erro ? <p className="cfg-error-txt">{erro}</p> : null}
        <div className="cfg-dialog-actions">
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="cfg-btn cfg-btn--primary" disabled={busy} onClick={() => void confirmar()}>
            Registrar saída
          </button>
        </div>
      </div>
    </div>
  )
}

function DialogoExcluir({
  socio,
  onClose,
  onOk,
  onSaida,
  onReauth,
}: {
  socio: Socio
  onClose: () => void
  onOk: () => void
  onSaida: () => void
  onReauth: (retry: () => void) => void
}) {
  const [nome, setNome] = useState('')
  const [desativar, setDesativar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const ok = nome === socio.nomeCompleto

  async function confirmar() {
    setBusy(true)
    const result = await excluirSocio(socio.id, { confirmacaoNome: nome, desativarConvite: desativar })
    setBusy(false)
    if (!result.ok) {
      if (result.code === 'reauth') {
        onReauth(() => void confirmar())
        return
      }
      setErro(result.message ?? 'Não foi possível excluir.')
      return
    }
    onOk()
  }

  return (
    <div className="cfg-overlay">
      <div className="cfg-dialog" role="dialog" aria-modal="true">
        <h2>Excluir cadastro de {socio.nomeCompleto}?</h2>
        <p>
          Esta ação remove o cadastro permanentemente. Use apenas para corrigir um cadastro criado por engano. Se o sócio realmente deixou a sociedade, registre a saída.
        </p>
        <div className="cfg-field" style={{ marginTop: 14 }}>
          <label htmlFor="cfg-exc-nome">Digite o nome completo para confirmar</label>
          <input id="cfg-exc-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        {socio.usuarioId ? (
          <label className="cfg-check">
            <input type="checkbox" checked={desativar} onChange={(e) => setDesativar(e.target.checked)} />
            Desativar o convite de acesso vinculado
          </label>
        ) : null}
        {erro ? <p className="cfg-error-txt">{erro}</p> : null}
        <div className="cfg-dialog-actions">
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onSaida}>
            Registrar saída em vez disso
          </button>
          <button type="button" className="cfg-btn cfg-btn--danger" disabled={!ok || busy} onClick={() => void confirmar()}>
            Excluir cadastro
          </button>
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
