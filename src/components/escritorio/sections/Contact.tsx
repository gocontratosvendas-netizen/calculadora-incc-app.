import { useId, useState, type FormEvent } from 'react'
import { site } from '../../../content/escritorioSite'
import {
  emptyContactForm,
  formatPhoneBr,
  validateContactForm,
  type ContactFormErrors,
  type ContactFormValues,
} from '../../../lib/escritorioValidation'
import { Button } from '../ui/Button'
import { IconMail, IconPhone, IconPin } from '../ui/Icons'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'
import { SectionTitle } from '../ui/SectionTitle'

const lineIcons = {
  pin: IconPin,
  mail: IconMail,
  phone: IconPhone,
} as const

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function Contact() {
  const { contact } = site
  const formId = useId()
  const [values, setValues] = useState<ContactFormValues>(emptyContactForm)
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [status, setStatus] = useState<Status>('idle')

  function updateField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (values.website) return

    const nextErrors = validateContactForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setStatus('submitting')
    try {
      // Provisório: sem backend SMTP neste app Vite.
      await new Promise((resolve) => setTimeout(resolve, 700))
      setStatus('success')
      setValues(emptyContactForm())
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contato" className="escritorio-section esc-contact" aria-labelledby="contact-title">
      <div className="escritorio-container esc-contact__grid">
        <Reveal>
          <SectionLabel onDark>{contact.label}</SectionLabel>
          <SectionTitle id="contact-title" onDark>
            {contact.title}
          </SectionTitle>
          <p className="esc-contact__intro">{contact.body}</p>
          <ul className="esc-contact__lines">
            {contact.lines.map((line) => {
              const Icon = lineIcons[line.icon]
              const content = (
                <>
                  <Icon />
                  <span>{line.text}</span>
                </>
              )
              return (
                <li key={line.text}>
                  {line.href ? <a href={line.href}>{content}</a> : content}
                </li>
              )
            })}
          </ul>
        </Reveal>

        <Reveal>
          <div className="esc-form">
            {status === 'success' ? (
              <p className="esc-form__status" role="status">
                {contact.form.successMessage}
              </p>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="esc-form__honeypot" aria-hidden="true">
                  <label htmlFor={`${formId}-website`}>Website</label>
                  <input
                    id={`${formId}-website`}
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.website}
                    onChange={(e) => updateField('website', e.target.value)}
                  />
                </div>

                <div className="esc-field">
                  <label htmlFor={`${formId}-name`}>{contact.form.nameLabel}</label>
                  <input
                    id={`${formId}-name`}
                    name="name"
                    autoComplete="name"
                    value={values.name}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                  {errors.name ? (
                    <p id={`${formId}-name-error`} className="esc-field__error">
                      {errors.name}
                    </p>
                  ) : null}
                </div>

                <div className="esc-field">
                  <label htmlFor={`${formId}-email`}>{contact.form.emailLabel}</label>
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={values.email}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                  {errors.email ? (
                    <p id={`${formId}-email-error`} className="esc-field__error">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div className="esc-field">
                  <label htmlFor={`${formId}-phone`}>{contact.form.phoneLabel}</label>
                  <input
                    id={`${formId}-phone`}
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={values.phone}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? `${formId}-phone-error` : undefined}
                    onChange={(e) => updateField('phone', formatPhoneBr(e.target.value))}
                  />
                  {errors.phone ? (
                    <p id={`${formId}-phone-error`} className="esc-field__error">
                      {errors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="esc-field">
                  <label htmlFor={`${formId}-subject`}>{contact.form.subjectLabel}</label>
                  <textarea
                    id={`${formId}-subject`}
                    name="subject"
                    rows={4}
                    value={values.subject}
                    aria-invalid={Boolean(errors.subject)}
                    aria-describedby={errors.subject ? `${formId}-subject-error` : undefined}
                    onChange={(e) => updateField('subject', e.target.value)}
                  />
                  {errors.subject ? (
                    <p id={`${formId}-subject-error`} className="esc-field__error">
                      {errors.subject}
                    </p>
                  ) : null}
                </div>

                <div className="esc-check">
                  <input
                    id={`${formId}-consent`}
                    type="checkbox"
                    checked={values.consent}
                    aria-invalid={Boolean(errors.consent)}
                    aria-describedby={errors.consent ? `${formId}-consent-error` : undefined}
                    onChange={(e) => updateField('consent', e.target.checked)}
                  />
                  <label htmlFor={`${formId}-consent`}>{contact.form.consentLabel}</label>
                </div>
                {errors.consent ? (
                  <p id={`${formId}-consent-error`} className="esc-field__error">
                    {errors.consent}
                  </p>
                ) : null}

                {status === 'error' ? (
                  <p className="esc-field__error" role="alert">
                    {contact.form.errorMessage}{' '}
                    <button
                      type="button"
                      className="esc-form__retry"
                      onClick={() => setStatus('idle')}
                    >
                      Tentar novamente
                    </button>
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  block
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting'
                    ? contact.form.submittingLabel
                    : contact.form.submitLabel}
                </Button>

                <p className="esc-form__legal">{contact.form.legalNotice}</p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
