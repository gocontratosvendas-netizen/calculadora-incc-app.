import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { erro: Error | null }

export class ConfiguracoesErrorBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[configuracoes]', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="cfg-page">
        <div className="cfg-error">
          <h1>Algo deu errado nesta seção</h1>
          <div className="cfg-header-rule" />
          <p className="cfg-header-sub">Os demais módulos não foram afetados.</p>
          <button type="button" className="cfg-btn cfg-btn--primary" style={{ marginTop: 12 }} onClick={() => this.setState({ erro: null })}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }
}
