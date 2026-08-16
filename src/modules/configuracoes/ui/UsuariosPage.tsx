import { useEffect, useState } from 'react'
import { NIVEIS_PERMISSAO, RECURSOS, alterarPermissaoPermitido, confirmacaoComContexto, niveisPermitidosNaCelula, podeAcessarMapa } from '../autorizacao'
import { conviteInputSchema } from '../data/schemas'
import { despejarFilaEmails } from '../data/email'
import {
  alterarPapel,
  alterarPermissao,
  convidarUsuario,
  criarPapel,
  excluirPapel,
  forcarRedefinicao,
  listarPapeis,
  listarUsuarios,
  mudarSituacao,
  reenviarConvite,
} from '../data/repositorio'
import { formatarDataHora, iniciaisDe } from '../format'
import type { NivelPermissao, Papel, Recurso, Usuario, UsuarioSessao } from '../types'
import { ReauthDialog } from './ReauthDialog'

type Props = { sessao: UsuarioSessao }

const ROTULO_RECURSO: Record<Recurso, string> = {
  calculadora: 'Calculadora',
  casos: 'Casos',
  parcerias: 'Parcerias',
  documentos: 'Documentos',
  'financeiro.lancamentos': 'Financeiro · lançamentos',
  'financeiro.dre': 'Financeiro · DRE',
  'configuracoes.socios': 'Configurações · sócios',
  'configuracoes.usuarios': 'Configurações · usuários',
  'configuracoes.auditoria': 'Configurações · auditoria',
}

const SITUACAO: Record<Usuario['situacao'], string> = {
  ativo: 'Ativo',
  convidado: 'Convidado',
  suspenso: 'Suspenso',
  desativado: 'Desativado',
}

type Confirmacao =
  | { kind: 'papel'; usuario: Usuario; papelId: string }
  | { kind: 'reenviar'; usuario: Usuario }
  | { kind: 'reset'; usuario: Usuario }
  | { kind: 'suspender'; usuario: Usuario }
  | { kind: 'reativar'; usuario: Usuario }
  | { kind: 'desativar'; usuario: Usuario }

export function UsuariosPage({ sessao }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const [salvarMsg, setSalvarMsg] = useState('')
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const [reauthPend, setReauthPend] = useState<(() => void) | null>(null)
  const [conviteAberto, setConviteAberto] = useState(false)
  const [papelNovo, setPapelNovo] = useState(false)
  const podeEditar = podeAcessarMapa(sessao.permissoes, 'configuracoes.usuarios', 'editar')
  const podeTotal = podeAcessarMapa(sessao.permissoes, 'configuracoes.usuarios', 'total')

  async function recarregar() {
    const [u, p] = await Promise.all([listarUsuarios(), listarPapeis()])
    if (u.ok) setUsuarios(u.data)
    if (p.ok) setPapeis(p.data)
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([listarUsuarios(), listarPapeis()]).then(([u, p]) => {
      if (cancelled) return
      if (u.ok) setUsuarios(u.data)
      if (p.ok) setPapeis(p.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function papelNome(id: string) {
    return papeis.find((p) => p.id === id)?.nome ?? id
  }

  async function executar(c: Confirmacao) {
    let result: { ok: boolean; code?: string; message?: string }
    if (c.kind === 'papel') result = await alterarPapel(c.usuario.id, c.papelId)
    else if (c.kind === 'reenviar') result = await reenviarConvite(c.usuario.id)
    else if (c.kind === 'reset') result = await forcarRedefinicao(c.usuario.id)
    else if (c.kind === 'suspender') result = await mudarSituacao(c.usuario.id, 'suspenso')
    else if (c.kind === 'reativar') result = await mudarSituacao(c.usuario.id, 'ativo')
    else result = await mudarSituacao(c.usuario.id, 'desativado')
    if (!result.ok) {
      if (result.code === 'reauth') {
        setReauthPend(() => () => void executar(c))
        return
      }
      setSalvarMsg(result.message ?? 'Não foi possível concluir.')
      return
    }
    setConfirmacao(null)
    await recarregar()
    void despejarFilaEmails()
    setFlashId(c.usuario.id)
    window.setTimeout(() => setFlashId(null), 1500)
  }

  function frase(c: Confirmacao): string {
    if (c.kind === 'papel') return confirmacaoComContexto(`Alterar o papel de ${c.usuario.nome} para ${papelNome(c.papelId)}`)
    if (c.kind === 'reenviar') return confirmacaoComContexto(`Reenviar o convite de ${c.usuario.nome}`)
    if (c.kind === 'reset') return confirmacaoComContexto(`Forçar a redefinição de senha de ${c.usuario.nome}`)
    if (c.kind === 'suspender') return confirmacaoComContexto(`Suspender a conta de ${c.usuario.nome}`)
    if (c.kind === 'reativar') return confirmacaoComContexto(`Reativar a conta de ${c.usuario.nome}`)
    return confirmacaoComContexto(`Desativar definitivamente a conta de ${c.usuario.nome}`)
  }

  return (
    <>
      <div className="cfg-toolbar">
        <div className="cfg-toolbar-right">
          {podeEditar ? (
            <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => setPapelNovo(true)}>
              Novo papel
            </button>
          ) : null}
          {podeTotal ? (
            <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => setConviteAberto(true)}>
              Convidar
            </button>
          ) : null}
        </div>
      </div>

      <div className="cfg-table-wrap">
        <table className="cfg-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Últ. acesso</th>
              <th>2FA</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={flashId === u.id ? 'cfg-row--flash' : ''}>
                <td>
                  <span className="cfg-person">
                    <span className="cfg-avatar">{iniciaisDe(u.nome)}</span>
                    <span>
                      <span className="cfg-nome">{u.nome}</span>
                      <br />
                      <span style={{ fontSize: 11, color: '#6b7686' }}>{u.email}</span>
                    </span>
                  </span>
                </td>
                <td>
                  <span className={`cfg-badge cfg-badge--${u.papelId}`}>{papelNome(u.papelId)}</span>
                </td>
                <td>{u.ultimoAcesso ? formatarDataHora(u.ultimoAcesso) : '—'}</td>
                <td>{u.doisFatoresAtivo ? 'Ativo' : '—'}</td>
                <td>
                  <span className={`cfg-badge cfg-badge--${u.situacao}`}>{SITUACAO[u.situacao]}</span>
                </td>
                <td>
                  <div className="cfg-row-actions">
                    {podeTotal && u.id !== sessao.id && u.situacao !== 'desativado' ? (
                      <select
                        aria-label={`Alterar papel de ${u.nome}`}
                        defaultValue={u.papelId}
                        onChange={(e) => {
                          const papelId = e.target.value
                          e.target.value = u.papelId
                          setConfirmacao({ kind: 'papel', usuario: u, papelId })
                        }}
                      >
                        {papeis.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {podeEditar && u.situacao === 'convidado' ? (
                      <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => setConfirmacao({ kind: 'reenviar', usuario: u })}>
                        Reenviar convite
                      </button>
                    ) : null}
                    {podeEditar && u.situacao === 'ativo' ? (
                      <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => setConfirmacao({ kind: 'reset', usuario: u })}>
                        Redefinir senha
                      </button>
                    ) : null}
                    {podeTotal && u.id !== sessao.id && u.situacao === 'ativo' ? (
                      <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => setConfirmacao({ kind: 'suspender', usuario: u })}>
                        Suspender
                      </button>
                    ) : null}
                    {podeTotal && u.situacao === 'suspenso' ? (
                      <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => setConfirmacao({ kind: 'reativar', usuario: u })}>
                        Reativar
                      </button>
                    ) : null}
                    {podeTotal && u.id !== sessao.id && u.situacao !== 'desativado' ? (
                      <button type="button" className="cfg-btn cfg-btn--danger" onClick={() => setConfirmacao({ kind: 'desativar', usuario: u })}>
                        Desativar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 500, color: '#16346b', margin: '22px 0 10px' }}>Matriz de permissões</h2>
      <div className="cfg-matriz">
        <table className="cfg-table">
          <thead>
            <tr>
              <th>Recurso</th>
              {papeis.map((p) => (
                <th key={p.id}>
                  {p.nome}
                  {p.imutavel ? ' · bloqueada' : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECURSOS.map((recurso) => (
              <tr key={recurso}>
                <td>{ROTULO_RECURSO[recurso]}</td>
                {papeis.map((papel) => {
                  const nivel = papel.permissoes[recurso] ?? 'nenhum'
                  const bloqueado = niveisPermitidosNaCelula(papel.id, recurso) === 'bloqueado' || !podeTotal
                  return (
                    <td key={papel.id}>
                      <select
                        className={`cfg-nivel is-${nivel}`}
                        value={nivel}
                        disabled={bloqueado}
                        aria-label={`${ROTULO_RECURSO[recurso]} · ${papel.nome}`}
                        onChange={(e) => {
                          const novo = e.target.value as NivelPermissao
                          if (!alterarPermissaoPermitido(papel.id, recurso, novo)) return
                          void (async () => {
                            const result = await alterarPermissao(papel.id, recurso, novo)
                            if (!result.ok && result.code === 'reauth') {
                              setReauthPend(() => () => {
                                void alterarPermissao(papel.id, recurso, novo).then(() => recarregar())
                              })
                              return
                            }
                            if (result.ok) {
                              setSalvarMsg('Permissão atualizada')
                              window.setTimeout(() => setSalvarMsg(''), 1800)
                              await recarregar()
                              void despejarFilaEmails()
                            }
                          })()
                        }}
                      >
                        {NIVEIS_PERMISSAO.filter((n) => niveisPermitidosNaCelula(papel.id, recurso) === 'bloqueado' || (niveisPermitidosNaCelula(papel.id, recurso) as string[]).includes(n)).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cfg-note">A coluna Sócio é bloqueada. Auditoria não admite edição por nenhum papel.</p>
      {salvarMsg ? <div className="cfg-toast">{salvarMsg}</div> : null}

      {confirmacao ? (
        <div className="cfg-overlay">
          <div className="cfg-dialog" role="dialog" aria-modal="true">
            <h2>{frase(confirmacao)}</h2>
            <div className="cfg-dialog-actions">
              <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => setConfirmacao(null)}>
                Cancelar
              </button>
              <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => void executar(confirmacao)}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {conviteAberto ? (
        <ConviteDialog
          papeis={papeis}
          onClose={() => setConviteAberto(false)}
          onOk={async () => {
            setConviteAberto(false)
            await recarregar()
            void despejarFilaEmails()
          }}
        />
      ) : null}
      {papelNovo ? (
        <PapelDialog
          papeis={papeis}
          onClose={() => setPapelNovo(false)}
          onOk={async () => {
            setPapelNovo(false)
            await recarregar()
          }}
          onExcluir={async (id) => {
            const result = await excluirPapel(id)
            if (result.ok) await recarregar()
          }}
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

function ConviteDialog({ papeis, onClose, onOk }: { papeis: Papel[]; onClose: () => void; onOk: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papelId, setPapelId] = useState('operacao')
  const [erro, setErro] = useState('')

  async function enviar() {
    const parsed = conviteInputSchema.safeParse({ nome, email, papelId })
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }
    const result = await convidarUsuario(parsed.data)
    if (!result.ok) {
      setErro(result.errors?.email ?? result.message ?? 'Não foi possível convidar.')
      return
    }
    onOk()
  }

  return (
    <div className="cfg-overlay">
      <div className="cfg-dialog" role="dialog" aria-modal="true">
        <h2>Convidar usuário</h2>
        <div className="cfg-field" style={{ marginTop: 14 }}>
          <label htmlFor="cfg-c-nome">Nome</label>
          <input id="cfg-c-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-c-email">E-mail</label>
          <input id="cfg-c-email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-c-papel">Papel</label>
          <select id="cfg-c-papel" value={papelId} onChange={(e) => setPapelId(e.target.value)}>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        {erro ? <p className="cfg-error-txt">{erro}</p> : null}
        <div className="cfg-dialog-actions">
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => void enviar()}>
            Enviar convite
          </button>
        </div>
      </div>
    </div>
  )
}

function PapelDialog({
  papeis,
  onClose,
  onOk,
  onExcluir,
}: {
  papeis: Papel[]
  onClose: () => void
  onOk: () => void
  onExcluir: (id: string) => void
}) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [origemId, setOrigemId] = useState('leitura')
  const [erro, setErro] = useState('')

  async function criar() {
    const result = await criarPapel({ nome, descricao, origemId })
    if (!result.ok) {
      setErro(result.message ?? 'Não foi possível criar.')
      return
    }
    onOk()
  }

  return (
    <div className="cfg-overlay">
      <div className="cfg-dialog" role="dialog" aria-modal="true">
        <h2>Novo papel</h2>
        <div className="cfg-field" style={{ marginTop: 14 }}>
          <label htmlFor="cfg-p-nome">Nome</label>
          <input id="cfg-p-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-p-desc">Descrição</label>
          <input id="cfg-p-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-p-origem">Partir de</label>
          <select id="cfg-p-origem" value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        {erro ? <p className="cfg-error-txt">{erro}</p> : null}
        <div className="cfg-dialog-actions">
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => void criar()}>
            Criar
          </button>
        </div>
        <p className="cfg-note">Papel com usuários vinculados não pode ser excluído. Migre-os antes.</p>
        <ul style={{ fontSize: 12, color: '#5b6474', paddingLeft: 16 }}>
          {papeis.filter((p) => !p.imutavel).map((p) => (
            <li key={p.id}>
              {p.nome} ({p.usuariosVinculados}){' '}
              {p.usuariosVinculados === 0 ? (
                <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => onExcluir(p.id)}>
                  Excluir
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
