import { marcarEmailEnviado, listarFilaEmails } from './repositorio'

export async function despejarFilaEmails(): Promise<number> {
  const itens = await listarFilaEmails()
  let n = 0
  for (const item of itens) {
    const link = item.payload && typeof item.payload.link === 'string' ? item.payload.link : null
    if (import.meta.env.DEV || !import.meta.env.VITE_RESEND_API_KEY) {
      console.info(`[VERUM e-mail/${item.tipo}] para ${item.destinatario}: ${link ?? item.assunto}`)
    }
    await marcarEmailEnviado(item.id)
    n += 1
  }
  if (n > 0 && (import.meta.env.DEV || !import.meta.env.VITE_RESEND_API_KEY)) {
    console.info(`[VERUM] ${n} e-mail(s) da fila impressos no console (EMAIL_PROVIDER=console).`)
  }
  return n
}
