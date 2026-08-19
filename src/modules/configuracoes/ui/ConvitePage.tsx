import { useEffect, useState, type FormEvent } from 'react'
import { senhaAceita, senhasConferem } from '../autorizacao'
import { peekToken, solicitarNovoConvite } from '../data/repositorio'
import { supabase } from '../../../lib/supabase'
import './configuracoes.css'

async function aceitarConvite(token: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke('cfg-auth', {
    body: { action: 'accept-invite', token, password },
  })
  const payload = data as { ok?: boolean; message?: string; session?: { access_token?: string; refresh_token?: string } }
  if (!error && payload?.ok && payload.session?.access_token && payload.session.refresh_token) {
    await supabase.auth.setSession({
      access_token: payload.session.access_token,
      refresh_token: payload.session.refresh_token,
    })
    return { ok: true }
  }
  if (error) {
    const msg = typeof error.message === 'string' ? error.message : ''
    if (/Failed to send a request|FunctionsHttpError|404|not found/i.test(msg)) {
      return { ok: false, message: 'Serviço de confirmação temporariamente indisponível. Tente novamente em instantes.' }
    }
    return { ok: false, message: msg || 'Não foi possível concluir no momento. Tente novamente.' }
  }
  return { ok: false, message: payload?.message ?? 'Este link não é mais válido.' }
}

export function ConvitePage({ token }: { token: string }) {
  const [estado, setEstado] = useState<'ok' | 'invalido' | 'loading'>('loading')
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [pedido, setPedido] = useState(false)
  const [emailPedido, setEmailPedido] = useState('')

  useEffect(() => {
    void peekToken(token).then((result) => {
      if (!result.ok || result.data.tipo !== 'convite') {
        setEstado('invalido')
        return
      }
      setNome(result.data.nome)
      setPapel(result.data.papel)
      setEstado('ok')
    })
  }, [token])

  async function enviar(event: FormEvent) {
    event.preventDefault()
    const senhaOk = senhaAceita(senha)
    if (!senhaOk.ok) {
      setErro(senhaOk.motivo)
      return
    }
    if (!senhasConferem(senha, confirma)) {
      setErro('A confirmação não confere.')
      return
    }
    const result = await aceitarConvite(token, senha)
    if (!result.ok) {
      setErro(result.message)
      return
    }
    window.location.assign('/')
  }

  if (estado === 'loading') {
    return (
      <div className="cfg-public">
        <div className="cfg-public-card" />
      </div>
    )
  }

  if (estado === 'invalido') {
    return (
      <div className="cfg-public">
        <div className="cfg-public-card">
          <h1 className="cfg-header" style={{ display: 'block', border: 0, padding: 0 }}>
            Link inválido
          </h1>
          <p className="cfg-header-sub">Este convite expirou ou já foi usado.</p>
          <div className="cfg-field" style={{ marginTop: 14 }}>
            <label htmlFor="cfg-nv-email">E-mail</label>
            <input id="cfg-nv-email" type="email" value={emailPedido} onChange={(e) => setEmailPedido(e.target.value)} />
          </div>
          <button
            type="button"
            className="cfg-btn cfg-btn--primary"
            style={{ marginTop: 8 }}
            onClick={() => {
              void solicitarNovoConvite(emailPedido).then(() => setPedido(true))
            }}
          >
            Solicitar novo convite
          </button>
          {pedido ? <p className="cfg-note">Se o pedido for válido, um sócio enviará um novo convite.</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-public">
      <div className="cfg-public-card">
        <h1 style={{ margin: 0, fontSize: 18, color: '#16346b' }}>Definir senha</h1>
        <p className="cfg-header-sub">
          {nome} · {papel}
        </p>
        <div className="cfg-password-rules" aria-label="Requisitos da senha">
          <p className="cfg-password-rules-title">Requisitos da senha</p>
          <ul>
            <li>No mínimo 12 caracteres.</li>
            <li>Combinar letras e números.</li>
            <li>Evitar sequências e senhas óbvias.</li>
          </ul>
        </div>
        <form onSubmit={(e) => void enviar(e)} style={{ marginTop: 18 }}>
          <div className="cfg-field">
            <label htmlFor="cfg-senha">Senha</label>
            <input id="cfg-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="cfg-field">
            <label htmlFor="cfg-senha2">Confirmação</label>
            <input id="cfg-senha2" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
          {erro ? <p className="cfg-error-txt">{erro}</p> : null}
          <button type="submit" className="cfg-btn cfg-btn--primary" style={{ width: '100%' }}>
            Entrar no VERUM
          </button>
        </form>
      </div>
    </div>
  )
}
