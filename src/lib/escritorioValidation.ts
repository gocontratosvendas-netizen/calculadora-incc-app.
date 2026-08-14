export type ContactFormValues = {
  name: string
  email: string
  phone: string
  subject: string
  consent: boolean
  website: string // honeypot
}

export type ContactFormErrors = Partial<
  Record<keyof Omit<ContactFormValues, 'website'>, string>
>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emptyContactForm(): ContactFormValues {
  return {
    name: '',
    email: '',
    phone: '',
    subject: '',
    consent: false,
    website: '',
  }
}

export function formatPhoneBr(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {}

  if (values.name.trim().length < 3) {
    errors.name = 'Informe o nome completo (mínimo 3 caracteres).'
  }

  if (!values.email.trim()) {
    errors.email = 'Informe o e-mail.'
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (values.phone.trim()) {
    const digits = values.phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) {
      errors.phone = 'Informe um telefone válido com DDD.'
    }
  }

  if (values.subject.trim().length < 20) {
    errors.subject = 'Descreva o assunto com pelo menos 20 caracteres.'
  }

  if (!values.consent) {
    errors.consent = 'É necessário autorizar o contato e o tratamento dos dados.'
  }

  return errors
}
