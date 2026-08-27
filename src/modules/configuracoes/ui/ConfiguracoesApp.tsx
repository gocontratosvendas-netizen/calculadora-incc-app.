import { useEffect, useState } from 'react'
import { Link } from '../../../lib/router'
import { useRouter } from '../../../lib/router-context'
import { podeAcessarMapa, temAlgumaPermissaoConfiguracoes } from '../autorizacao'
import { diagnosticarSessao, invalidarSessaoCfg } from '../acesso'
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

  const aba = abaDe(pathname)
  const abasVisiveis = ABAS.filter((item) => podeAcessarMapa(sessao.permissoes, item.recurso, 'ler'))

  return (
    <div className="cfg-page">
      <header className="cfg-header">
        <div>
          <h1>Configurações</h1>
          <div className="cfg-header-rule" />
          <p className="cfg-header-sub">Sócios, acessos e trilha de auditoria do escritório.</p>
        </div>
      </header>

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
