import { useState } from 'react'
import { signIn } from '../../../lib/auth'
import { loadCurrentUser } from '../../../lib/session'
import { invalidarSessaoCfg, usuarioAtual } from '../acesso'
import { marcarReauth } from '../data/repositorio'

type Props = {
  onOk: () => void
  onCancel: () => void
}

export function ReauthDialog({ onOk, onCancel }: Props) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirmar() {
    setBusy(true)
    setErro('')
    const sessao = await usuarioAtual()
    if (!sessao) {
      setErro('Sessão expirada.')
      setBusy(false)
      return
    }
    try {
      await signIn(sessao.email, senha)
      await marcarReauth()
      invalidarSessaoCfg()
      await loadCurrentUser().catch(() => null)
      onOk()
    } catch {
      setErro('Senha incorreta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cfg-overlay" role="presentation">
      <div className="cfg-dialog" role="dialog" aria-modal="true" aria-labelledby="cfg-reauth-title">
        <h2 id="cfg-reauth-title">Confirme sua senha</h2>
        <p>Esta ação exige reautenticação porque a última confirmação tem mais de 30 minutos.</p>
        <div className="cfg-field" style={{ marginTop: 14 }}>
          <label htmlFor="cfg-reauth-senha">Senha</label>
          <input
            id="cfg-reauth-senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoFocus
          />
          {erro ? <p className="cfg-error-txt">{erro}</p> : null}
        </div>
        <div className="cfg-dialog-actions">
          <button type="button" className="cfg-btn cfg-btn--secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => void confirmar()} disabled={busy || !senha}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
