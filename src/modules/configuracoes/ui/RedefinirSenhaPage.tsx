import { useEffect, useState, type FormEvent } from 'react'
import { senhaAceita, senhasConferem } from '../autorizacao'
import { peekToken } from '../data/repositorio'
import { supabase } from '../../../lib/supabase'
import './configuracoes.css'

export function RedefinirSenhaPage({ token }: { token: string }) {
  const [valido, setValido] = useState<boolean | null>(null)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    void peekToken(token).then((result) => {
      setValido(result.ok && result.data.tipo === 'redefinicao')
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
    const { data, error } = await supabase.functions.invoke('cfg-auth', {
      body: { action: 'confirm-reset', token, password: senha },
    })
    const payload = data as { ok?: boolean; session?: { access_token?: string; refresh_token?: string } }
    if (error || !payload?.ok) {
      setErro('Este link não é mais válido.')
      return
    }
    if (payload.session?.access_token && payload.session.refresh_token) {
      await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      })
    }
    window.location.assign('/')
  }

  if (valido === null) {
    return <div className="cfg-public" />
  }
  if (!valido) {
    return (
      <div className="cfg-public">
        <div className="cfg-public-card">
          <h1 style={{ margin: 0, fontSize: 18, color: '#16346b' }}>Link inválido</h1>
          <p className="cfg-header-sub">Este link expirou ou já foi usado. Solicite outro em Esqueci minha senha.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-public">
      <div className="cfg-public-card">
        <h1 style={{ margin: 0, fontSize: 18, color: '#16346b' }}>Nova senha</h1>
        <form onSubmit={(e) => void enviar(e)} style={{ marginTop: 18 }}>
          <div className="cfg-field">
            <label htmlFor="cfg-ns">Senha</label>
            <input id="cfg-ns" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="cfg-field">
            <label htmlFor="cfg-ns2">Confirmação</label>
            <input id="cfg-ns2" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </div>
          {erro ? <p className="cfg-error-txt">{erro}</p> : null}
          <button type="submit" className="cfg-btn cfg-btn--primary" style={{ width: '100%' }}>
            Redefinir senha
          </button>
        </form>
      </div>
    </div>
  )
}
