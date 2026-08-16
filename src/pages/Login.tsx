import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { signIn as signInWithSupabase } from '../lib/auth'
import { loadCurrentUser } from '../lib/session'
import { carregarEquipe, carregarUsuarioAtual } from '../lib/mural'

const COLORS = {
  panelBg: '#132339',
  gold: '#B9975B',
  formBg: '#FBFAF7',
  fieldBg: '#FFFFFF',
  fieldBorder: '#D3D0C8',
  title: '#132339',
  textSecondary: '#6C7684',
  label: '#4A5462',
  placeholder: '#A6ACB4',
  fieldText: '#3A424C',
  fieldIcon: '#9AA0A8',
  checkboxBorder: '#B0B5BC',
  checkboxText: '#5A636F',
  links: '#1F3A5F',
  wordmark: '#F4F1EA',
  eyebrow: '#8E9BAC',
  moduleList: '#A9B4C2',
  version: '#6F7C8D',
  divider: 'rgba(255,255,255,0.09)',
  error: '#A32D2D',
  errorBg: '#FCEBEB',
  fieldHoverBorder: '#B8B4AA',
  fieldFocusRing: 'rgba(19,35,57,0.08)',
  fieldErrorRing: 'rgba(163,45,45,0.10)',
  fieldDisabledBg: '#F2F1ED',
  buttonHover: '#1B3050',
  buttonFocusRing: 'rgba(19,35,57,0.18)',
  buttonText: '#F4F1EA',
  spinnerTrack: 'rgba(244,241,234,0.45)',
} as const

const APP_VERSION = '1.0'
const BRAND_NAME = 'VERUM'
const BRAND_INITIAL = 'V'
const AUTH_ERROR_MESSAGE = 'E-mail ou senha incorretos.'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type SignInInput = {
  email: string
  password: string
  rememberMe: boolean
}

type LoginProps = {
  onSuccess?: () => void
}

type LoginFormState = {
  email: string
  password: string
  rememberMe: boolean
  showPassword: boolean
  isLoading: boolean
  emailError: string
  passwordError: string
  formError: string
  emailInvalidated: boolean
  passwordInvalidated: boolean
}

async function signIn(credentials: SignInInput): Promise<void> {
  try {
    await signInWithSupabase(credentials.email, credentials.password, credentials.rememberMe)
    await Promise.all([loadCurrentUser(), carregarEquipe(), carregarUsuarioAtual()])
  } catch {
    throw new Error(AUTH_ERROR_MESSAGE)
  }
}

function validateEmail(value: string): string {
  const email = value.trim()
  if (!email) return 'Informe o e-mail.'
  if (!EMAIL_PATTERN.test(email)) return 'E-mail inválido.'
  return ''
}

function validatePassword(value: string): string {
  if (!value) return 'Informe a senha.'
  return ''
}

function IconEnvelope() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.25 4.25 8 8.5l5.75-4.25" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.25" y="7.25" width="9.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.25 7.25V5.4a2.75 2.75 0 0 1 5.5 0v1.85"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.6 8s2.4-4.25 6.4-4.25S14.4 8 14.4 8s-2.4 4.25-6.4 4.25S1.6 8 1.6 8Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="2.05" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.6 8s2.4-4.25 6.4-4.25S14.4 8 14.4 8s-2.4 4.25-6.4 4.25S1.6 8 1.6 8Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="2.05" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.2 12.8 12.8 3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconCalculator() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.75" y="1.75" width="11.5" height="11.5" rx="1.1" stroke="currentColor" strokeWidth="1.15" />
      <rect x="3.6" y="3.5" width="7.8" height="2.1" fill="currentColor" />
      <rect x="3.6" y="7.2" width="1.7" height="1.5" fill="currentColor" />
      <rect x="6.65" y="7.2" width="1.7" height="1.5" fill="currentColor" />
      <rect x="9.7" y="7.2" width="1.7" height="1.5" fill="currentColor" />
      <rect x="3.6" y="10.1" width="1.7" height="1.5" fill="currentColor" />
      <rect x="6.65" y="10.1" width="1.7" height="1.5" fill="currentColor" />
      <rect x="9.7" y="10.1" width="1.7" height="1.5" fill="currentColor" />
    </svg>
  )
}

function IconDocument() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M4 2.25h5.1L11.75 5v7.75H4V2.25Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path d="M9.05 2.35V5h2.65" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      <path d="M5.4 11V8.35M7.5 11V7.55M9.6 11V8.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconFolders() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M1.7 6.1V4.2c0-.5.4-.9.9-.9h2.15l1.1 1.15h4.1c.5 0 .9.4.9.9v1.75"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M2.35 6.35h9.7c.7 0 1.2.65 1.05 1.33l-.7 3.15a1.1 1.1 0 0 1-1.08.87H3.08A1.1 1.1 0 0 1 2 10.83l-.7-3.15c-.15-.68.35-1.33 1.05-1.33Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const LOGIN_CSS = `
.login-page {
  position: fixed;
  inset: 0;
  display: flex;
  width: 100%;
  min-height: 100vh;
  height: 100%;
  overflow: auto;
  font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
  font-weight: 400;
  color-scheme: light;
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
.login-page *,
.login-page *::before,
.login-page *::after {
  box-sizing: border-box;
}
.login-page h1 {
  margin: 0;
  font-family: inherit;
  letter-spacing: normal;
}
.login-page p {
  font-family: inherit;
  letter-spacing: normal;
}
.login-page button,
.login-page input {
  font-family: inherit;
}
@media (min-width: 1024px) and (min-height: 768px) {
  .login-page {
    overflow: hidden;
  }
}

.login-panel {
  width: 41%;
  flex: 0 0 41%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 44px;
  background: ${COLORS.panelBg};
}
.login-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.login-monogram {
  width: 42px;
  height: 42px;
  border: 1px solid ${COLORS.gold};
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.gold};
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 19px;
  font-weight: 500;
  line-height: 1;
  background: transparent;
}
.login-brand-copy {
  margin-top: 20px;
}
.login-wordmark {
  color: ${COLORS.wordmark};
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.22em;
  line-height: 1.2;
}
.login-eyebrow {
  margin-top: 5px;
  color: ${COLORS.eyebrow};
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  line-height: 1.3;
}
.login-fillet {
  width: 32px;
  height: 1px;
  background: ${COLORS.gold};
  margin: 18px 0;
}
.login-modules {
  list-style: none;
  margin: 0;
  padding: 0;
}
.login-modules li {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 11px;
  color: ${COLORS.moduleList};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
}
.login-modules li:last-child {
  margin-bottom: 0;
}
.login-modules svg {
  flex-shrink: 0;
  color: ${COLORS.gold};
}
.login-panel-rule {
  height: 1px;
  margin: 18px 0 12px;
  background: ${COLORS.divider};
  border: 0;
}
.login-version {
  color: ${COLORS.version};
  font-size: 10.5px;
  font-weight: 400;
  letter-spacing: 0.05em;
  line-height: 1.4;
}

.login-form-column {
  width: 59%;
  flex: 0 0 59%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${COLORS.formBg};
}
.login-form-block {
  width: 100%;
  max-width: 380px;
}
.login-title {
  color: ${COLORS.title};
  font-size: 18px;
  font-weight: 500;
  line-height: 1.3;
}
.login-subtitle {
  margin: 12px 0 32px;
  color: ${COLORS.textSecondary};
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.6;
}
.login-alert {
  margin-bottom: 18px;
  padding: 10px 12px;
  border-radius: 6px;
  background: ${COLORS.errorBg};
  color: ${COLORS.error};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.45;
}
.login-alert:focus {
  outline: none;
  box-shadow: 0 0 0 3px ${COLORS.fieldErrorRing};
}
.login-field-group {
  margin-bottom: 16px;
}
.login-field-group--password {
  margin-bottom: 14px;
}
.login-label {
  display: block;
  margin-bottom: 8px;
  color: ${COLORS.label};
  font-size: 11.5px;
  font-weight: 400;
  letter-spacing: 0.06em;
  line-height: 1.3;
}
.login-field {
  height: 38px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 11px;
  background: ${COLORS.fieldBg};
  border: 0.5px solid ${COLORS.fieldBorder};
  border-radius: 6px;
  transition: border-color 140ms ease-out, box-shadow 140ms ease-out, background-color 140ms ease-out;
}
.login-field > svg {
  flex-shrink: 0;
  color: ${COLORS.fieldIcon};
  order: 0;
}
.login-field input {
  order: 1;
  flex: 1;
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: ${COLORS.fieldText};
  font-size: 13px;
  font-weight: 400;
  line-height: 1.3;
  box-shadow: none;
}
.login-field input::placeholder {
  color: ${COLORS.placeholder};
  opacity: 1;
}
.login-field:hover:not(.login-field--error):not(.login-field--disabled):not(:focus-within) {
  border-color: ${COLORS.fieldHoverBorder};
}
.login-field:focus-within {
  border-color: ${COLORS.title};
  box-shadow: 0 0 0 3px ${COLORS.fieldFocusRing};
}
.login-field--error {
  border-color: ${COLORS.error};
}
.login-field--error:focus-within {
  border-color: ${COLORS.error};
  box-shadow: 0 0 0 3px ${COLORS.fieldErrorRing};
}
.login-field--disabled {
  background: ${COLORS.fieldDisabledBg};
}
.login-field--disabled input {
  color: ${COLORS.placeholder};
  cursor: not-allowed;
}
.login-toggle {
  order: 2;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: ${COLORS.fieldIcon};
  cursor: pointer;
  border-radius: 4px;
  transition: box-shadow 140ms ease-out;
}
.login-toggle:disabled {
  cursor: not-allowed;
}
.login-toggle:focus {
  outline: none;
}
.login-toggle:focus-visible {
  box-shadow: 0 0 0 3px ${COLORS.buttonFocusRing};
}
.login-field-error {
  margin-top: 5px;
  color: ${COLORS.error};
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.35;
}
.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
}
.login-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${COLORS.checkboxText};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  cursor: pointer;
}
.login-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 13px;
  height: 13px;
  margin: 0;
  flex-shrink: 0;
  border: 0.5px solid ${COLORS.checkboxBorder};
  border-radius: 3px;
  background-color: ${COLORS.fieldBg};
  background-repeat: no-repeat;
  background-position: center;
  background-size: 9px 9px;
  cursor: pointer;
  transition: border-color 140ms ease-out, box-shadow 140ms ease-out, background-color 140ms ease-out;
}
.login-checkbox:checked {
  background-color: ${COLORS.title};
  border-color: ${COLORS.title};
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 9 9'%3E%3Cpath fill='none' stroke='%23FFFFFF' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='M1.5 4.7 L3.6 6.7 L7.5 2.3'/%3E%3C/svg%3E");
}
.login-checkbox:disabled {
  cursor: not-allowed;
}
.login-checkbox:focus {
  outline: none;
}
.login-checkbox:focus-visible {
  box-shadow: 0 0 0 3px ${COLORS.buttonFocusRing};
}
.login-link {
  color: ${COLORS.links};
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  text-decoration: none;
  border-radius: 2px;
  transition: box-shadow 140ms ease-out;
}
.login-link:hover {
  text-decoration: underline;
}
.login-link:focus {
  outline: none;
}
.login-link:focus-visible {
  box-shadow: 0 0 0 3px ${COLORS.buttonFocusRing};
}
.login-submit {
  width: 100%;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 6px;
  background: ${COLORS.title};
  color: ${COLORS.buttonText};
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: pointer;
  transition: border-color 140ms ease-out, box-shadow 140ms ease-out, background-color 140ms ease-out;
}
.login-submit:hover:not(:disabled) {
  background: ${COLORS.buttonHover};
}
.login-submit:active:not(:disabled) {
  transform: scale(0.99);
}
.login-submit:focus {
  outline: none;
}
.login-submit:focus-visible {
  box-shadow: 0 0 0 3px ${COLORS.buttonFocusRing};
}
.login-submit:disabled {
  cursor: not-allowed;
}
.login-spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid ${COLORS.spinnerTrack};
  border-top-color: ${COLORS.buttonText};
  border-radius: 50%;
  animation: login-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1023px) {
  .login-page {
    flex-direction: column;
  }
  .login-panel {
    width: 100%;
    flex: 0 0 auto;
    padding: 28px 24px;
  }
  .login-brand {
    flex-direction: row;
    align-items: center;
  }
  .login-brand-copy {
    margin-top: 0;
    margin-left: 14px;
  }
  .login-fillet,
  .login-modules,
  .login-panel-rule,
  .login-version {
    display: none;
  }
  .login-form-column {
    width: 100%;
    flex: 1 1 auto;
    padding: 32px 24px;
    align-items: flex-start;
    justify-content: center;
  }
  .login-form-block {
    max-width: 420px;
    margin: 0 auto;
  }
}
`

const INITIAL_STATE: LoginFormState = {
  email: '',
  password: '',
  rememberMe: false,
  showPassword: false,
  isLoading: false,
  emailError: '',
  passwordError: '',
  formError: '',
  emailInvalidated: false,
  passwordInvalidated: false,
}

export default function Login({ onSuccess }: LoginProps = {}) {
  const [form, setForm] = useState<LoginFormState>(INITIAL_STATE)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = `Acesso restrito · ${BRAND_NAME}`
  }, [])

  useEffect(() => {
    if (form.formError) {
      alertRef.current?.focus()
    }
  }, [form.formError])

  function update<K extends keyof LoginFormState>(key: K, value: LoginFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    const email = event.target.value
    setForm((current) => ({
      ...current,
      email,
      emailError: current.emailInvalidated ? validateEmail(email) : current.emailError,
    }))
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const password = event.target.value
    setForm((current) => ({
      ...current,
      password,
      passwordError: current.passwordInvalidated ? validatePassword(password) : current.passwordError,
    }))
  }

  function handleEmailBlur() {
    if (!form.emailInvalidated) return
    update('emailError', validateEmail(form.email))
  }

  function handlePasswordBlur() {
    if (!form.passwordInvalidated) return
    update('passwordError', validatePassword(form.password))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.isLoading) return

    const emailError = validateEmail(form.email)
    const passwordError = validatePassword(form.password)

    setForm((current) => ({
      ...current,
      emailError,
      passwordError,
      formError: '',
      emailInvalidated: current.emailInvalidated || Boolean(emailError),
      passwordInvalidated: current.passwordInvalidated || Boolean(passwordError),
    }))

    if (emailError) {
      emailRef.current?.focus()
      return
    }
    if (passwordError) {
      passwordRef.current?.focus()
      return
    }

    setForm((current) => ({ ...current, isLoading: true, formError: '' }))
    try {
      await signIn({
        email: form.email.trim(),
        password: form.password,
        rememberMe: form.rememberMe,
      })
    } catch {
      setForm((current) => ({
        ...current,
        isLoading: false,
        formError: AUTH_ERROR_MESSAGE,
      }))
      return
    }
    setForm((current) => ({ ...current, isLoading: false }))
    onSuccess?.()
  }

  const emailFieldClass = [
    'login-field',
    form.emailError ? 'login-field--error' : '',
    form.isLoading ? 'login-field--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const passwordFieldClass = [
    'login-field',
    form.passwordError ? 'login-field--error' : '',
    form.isLoading ? 'login-field--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="login-page">
      <style>{LOGIN_CSS}</style>

      <aside className="login-panel">
        <div>
          <div className="login-brand">
            <div className="login-monogram" aria-hidden="true">
              {BRAND_INITIAL}
            </div>
            <div className="login-brand-copy">
              <div className="login-wordmark">{BRAND_NAME}</div>
              <p className="login-eyebrow">Ambiente interno</p>
            </div>
          </div>
          <div className="login-fillet" />
        </div>

        <div>
          <ul className="login-modules">
            <li>
              <IconCalculator />
              Calculadora INCC
            </li>
            <li>
              <IconDocument />
              Memoriais e relatórios
            </li>
            <li>
              <IconFolders />
              Base documental
            </li>
          </ul>
          <hr className="login-panel-rule" />
          <p className="login-version">v{APP_VERSION} · acesso registrado</p>
        </div>
      </aside>

      <div className="login-form-column">
        <div className="login-form-block">
          <h1 className="login-title">Acesso restrito</h1>
          <p className="login-subtitle">Uso exclusivo dos sócios e da equipe jurídica.</p>

          <form onSubmit={handleSubmit} noValidate aria-busy={form.isLoading}>
            {form.formError ? (
              <div ref={alertRef} className="login-alert" role="alert" tabIndex={-1}>
                {form.formError}
              </div>
            ) : null}

            <div className="login-field-group">
              <label className="login-label" htmlFor="login-email">
                E-mail
              </label>
              <div className={emailFieldClass}>
                <IconEnvelope />
                <input
                  ref={emailRef}
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="nome@empresa.com.br"
                  value={form.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  disabled={form.isLoading}
                  aria-invalid={form.emailError ? true : undefined}
                  aria-describedby={form.emailError ? 'login-email-error' : undefined}
                />
              </div>
              {form.emailError ? (
                <p id="login-email-error" className="login-field-error">
                  {form.emailError}
                </p>
              ) : null}
            </div>

            <div className="login-field-group login-field-group--password">
              <label className="login-label" htmlFor="login-password">
                Senha
              </label>
              <div className={passwordFieldClass}>
                <IconLock />
                <button
                  type="button"
                  className="login-toggle"
                  onClick={() => update('showPassword', !form.showPassword)}
                  disabled={form.isLoading}
                  aria-label={form.showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {form.showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={form.showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  disabled={form.isLoading}
                  aria-invalid={form.passwordError ? true : undefined}
                  aria-describedby={form.passwordError ? 'login-password-error' : undefined}
                />
              </div>
              {form.passwordError ? (
                <p id="login-password-error" className="login-field-error">
                  {form.passwordError}
                </p>
              ) : null}
            </div>

            <div className="login-options">
              <label className="login-remember" htmlFor="login-remember">
                <input
                  id="login-remember"
                  className="login-checkbox"
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    update('rememberMe', event.target.checked)
                  }}
                  disabled={form.isLoading}
                />
                Manter conectado
              </label>
              <a className="login-link" href="/recuperar-senha">
                Esqueci minha senha
              </a>
            </div>

            <button className="login-submit" type="submit" disabled={form.isLoading}>
              {form.isLoading ? <span className="login-spinner" aria-hidden="true" /> : null}
              {form.isLoading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
