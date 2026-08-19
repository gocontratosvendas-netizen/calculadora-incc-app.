import { useEffect, useState } from 'react'
import { Link } from '../../../lib/router'
import { useRouter } from '../../../lib/router-context'
import { acessoConfiguracoesBloqueadoPor2fa, aviso2faPendente, podeAcessarMapa, temAlgumaPermissaoConfiguracoes } from '../autorizacao'
import { diagnosticarSessao, invalidarSessaoCfg, usuarioAtual } from '../acesso'
import { marcar2fa } from '../data/repositorio'
import { supabase } from '../../../lib/supabase'
import type { UsuarioSessao } from '../types'
import { AuditoriaPage } from './AuditoriaPage'
import { ConfiguracoesErrorBoundary } from './ErrorBoundary'
import { SociosPage } from './SociosPage'
import { UsuariosPage } from './UsuariosPage'
import './configuracoes.css'

const ABAS = [
  { id: 'socios', to: '/configuracoes/socios', label: 'Sócios', recurso: 'configuracoes.socios' },
  { id: 'usuarios', to: '/configuracoes/usuarios', label: 'Usuários e acessos', recurso: 'configuracoes.usuarios' },
  { id: 'auditoria', to: '/configuracoes/auditoria', label: 'Auditoria', recurso: 'configuracoes.auditoria' },
] as const

function abaDe(pathname: string): (typeof ABAS)[number]['id'] {
  if (pathname.startsWith('/configuracoes/usuarios')) return 'usuarios'
  if (pathname.startsWith('/configuracoes/auditoria')) return 'auditoria'
  return 'socios'
}

export function ConfiguracoesApp() {
  return (
    <ConfiguracoesErrorBoundary>
      <ConfiguracoesInner />
    </ConfiguracoesErrorBoundary>
  )
}

function ConfiguracoesInner() {
  const { pathname, navigate } = useRouter()
  const [sessao, setSessao] = useState<UsuarioSessao | null | undefined>(undefined)
  const [schemaAusente, setSchemaAusente] = useState(false)
  const [mfaQr, setMfaQr] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [mfaErro, setMfaErro] = useState('')

  useEffect(() => {
    invalidarSessaoCfg()
    void diagnosticarSessao().then(({ sessao: atual, schemaAusente: faltaSchema }) => {
      setSessao(atual)
      setSchemaAusente(faltaSchema)
    })
  }, [])

  useEffect(() => {
    if (pathname === '/configuracoes') navigate('/configuracoes/socios', { replace: true })
  }, [pathname, navigate])

  if (sessao === undefined) return <div className="cfg-page" />

  if (schemaAusente) {
    return (
      <div className="cfg-page">
        <div className="cfg-403">
          <h1>Banco desatualizado</h1>
          <div className="cfg-header-rule" />
          <p className="cfg-header-sub">
            O menu aparece pelo seu perfil de sócio, mas as tabelas de Configurações ainda não estão neste banco.
            No terminal: <code>npx supabase migration up --local</code> e depois <code>npm run db:seed</code>.
            Recarregue a página.
          </p>
        </div>
      </div>
    )
  }

  if (!sessao || !temAlgumaPermissaoConfiguracoes(sessao.permissoes)) {
    return (
      <div className="cfg-page">
        <div className="cfg-403">
          <h1>Acesso restrito</h1>
          <div className="cfg-header-rule" />
          <p className="cfg-header-sub">Esta seção não está disponível para o seu perfil.</p>
        </div>
      </div>
    )
  }

  const bloqueado2fa = acessoConfiguracoesBloqueadoPor2fa({
    papelId: sessao.papelId,
    doisFatoresAtivo: sessao.doisFatoresAtivo,
    doisFatoresDesde: sessao.doisFatoresDesde,
  })
  const aba = abaDe(pathname)
  const abasVisiveis = ABAS.filter((item) => podeAcessarMapa(sessao.permissoes, item.recurso, 'ler'))

  async function iniciar2fa() {
    setMfaErro('')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'VERUM' })
    if (error || !data) {
      setMfaErro('Não foi possível iniciar o 2FA. Tente novamente.')
      return
    }
    setFactorId(data.id)
    setMfaQr(data.totp.qr_code)
  }

  async function confirmar2fa() {
    if (!factorId) return
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr || !challenge) {
      setMfaErro('Não foi possível verificar o código.')
      return
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: mfaCode })
    if (error) {
      setMfaErro('Código inválido.')
      return
    }
    await marcar2fa(true)
    invalidarSessaoCfg()
    setSessao(await usuarioAtual())
    setMfaQr(null)
  }

  if (bloqueado2fa) {
    return (
      <div className="cfg-page">
        <div className="cfg-403">
          <h1>Ative o 2FA para continuar</h1>
          <div className="cfg-header-rule" />
          <p className="cfg-header-sub">
            Sócios têm 7 dias para ativar a autenticação em dois fatores. O acesso a Configurações foi bloqueado até a ativação.
          </p>
          {!mfaQr ? (
            <button type="button" className="cfg-btn cfg-btn--primary" style={{ marginTop: 12 }} onClick={() => void iniciar2fa()}>
              Ativar 2FA
            </button>
          ) : (
            <div style={{ marginTop: 16 }}>
              <img src={mfaQr} alt="QR Code para autenticador" width={180} height={180} />
              <div className="cfg-field" style={{ marginTop: 12 }}>
                <label htmlFor="cfg-mfa-code">Código</label>
                <input id="cfg-mfa-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
              </div>
              {mfaErro ? <p className="cfg-error-txt">{mfaErro}</p> : null}
              <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => void confirmar2fa()}>
                Confirmar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-page">
      <header className="cfg-header">
        <div>
          <h1>Configurações</h1>
          <div className="cfg-header-rule" />
          <p className="cfg-header-sub">Sócios, acessos e trilha de auditoria do escritório.</p>
        </div>
      </header>

      {aviso2faPendente(sessao) ? (
        <div className="cfg-banner">
          <span>Ative a autenticação em dois fatores. Depois de 7 dias, o acesso a Configurações é bloqueado.</span>
          {!mfaQr ? (
            <button type="button" className="cfg-btn cfg-btn--secondary" onClick={() => void iniciar2fa()}>
              Ativar 2FA
            </button>
          ) : (
            <div>
              <img src={mfaQr} alt="QR Code para autenticador" width={120} height={120} />
              <input
                aria-label="Código 2FA"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000000"
                style={{ width: 100, marginLeft: 8 }}
              />
              <button type="button" className="cfg-btn cfg-btn--primary" onClick={() => void confirmar2fa()}>
                Confirmar
              </button>
              {mfaErro ? <p className="cfg-error-txt">{mfaErro}</p> : null}
            </div>
          )}
        </div>
      ) : null}

      <nav className="cfg-tabs" aria-label="Seções de configurações">
        {abasVisiveis.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className={aba === item.id ? 'cfg-tab is-active' : 'cfg-tab'}
            aria-current={aba === item.id ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {aba === 'socios' && podeAcessarMapa(sessao.permissoes, 'configuracoes.socios', 'ler') ? (
        <SociosPage sessao={sessao} />
      ) : null}
      {aba === 'usuarios' && podeAcessarMapa(sessao.permissoes, 'configuracoes.usuarios', 'ler') ? (
        <UsuariosPage sessao={sessao} />
      ) : null}
      {aba === 'auditoria' && podeAcessarMapa(sessao.permissoes, 'configuracoes.auditoria', 'ler') ? (
        <AuditoriaPage />
      ) : null}
    </div>
  )
}
