import { useState, type FormEvent } from 'react'
import { solicitarRedefinicao } from '../data/repositorio'
import './configuracoes.css'

const MSG = 'Se o e-mail existir, enviaremos um link de redefinição.'

export function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviar(event: FormEvent) {
    event.preventDefault()
    await solicitarRedefinicao(email)
    setEnviado(true)
  }

  return (
    <div className="cfg-public">
      <div className="cfg-public-card">
        <h1 style={{ margin: 0, fontSize: 18, color: '#16346b' }}>Redefinir senha</h1>
        <p className="cfg-header-sub">Informe o e-mail da conta. A resposta é a mesma exista ou não o cadastro.</p>
        <form onSubmit={(e) => void enviar(e)} style={{ marginTop: 18 }}>
          <div className="cfg-field">
            <label htmlFor="cfg-rec-email">E-mail</label>
            <input id="cfg-rec-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button type="submit" className="cfg-btn cfg-btn--primary" style={{ width: '100%' }}>
            Enviar link
          </button>
        </form>
        {enviado ? <p className="cfg-note">{MSG}</p> : null}
      </div>
    </div>
  )
}
