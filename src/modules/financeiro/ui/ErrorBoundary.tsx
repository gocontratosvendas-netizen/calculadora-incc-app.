import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { erro: Error | null }

export class FinanceiroErrorBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[financeiro]', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="fin-page">
        <div className="fin-error">
          <h1>Algo deu errado nesta seção</h1>
          <div className="fin-header-rule" />
          <p className="fin-header-sub">
            A calculadora e os demais módulos não foram afetados.
          </p>
          <button
            type="button"
            className="fin-btn fin-btn--primary"
            style={{ marginTop: 12 }}
            onClick={() => this.setState({ erro: null })}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }
}
