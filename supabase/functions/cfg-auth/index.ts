import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !serviceKey) return json({ ok: false, message: 'Configuração incompleta.' }, 500)

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  const action = String(body.action ?? '')

  async function rpc(fn: string, args: Record<string, unknown>, jwt?: string) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${jwt ?? serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
    return res.json()
  }

  if (action === 'accept-invite' || action === 'confirm-reset') {
    const token = String(body.token ?? '')
    const password = String(body.password ?? '')
    if (!token || password.length < 12) return json({ ok: false, message: 'Dados inválidos.' })

    const peek = await rpc('cfg_peek_token', { p_token: token })
    if (!peek?.ok) return json({ ok: false, message: 'Este link não é mais válido.' })
    const tipoEsperado = action === 'accept-invite' ? 'convite' : 'redefinicao'
    if (peek.tipo !== tipoEsperado) return json({ ok: false, message: 'Este link não é mais válido.' })

    const usuarioId = await rpc('cfg_consumir_token', { p_token: token, p_tipo: tipoEsperado })
    if (!usuarioId) return json({ ok: false, message: 'Este link não é mais válido.' })

    const usersRes = await fetch(`${url}/auth/v1/admin/users/${usuarioId}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    const tipo = action === 'confirm-reset' ? 'recovery' : 'invite'
    void tipo

    if (usersRes.ok) {
      await fetch(`${url}/auth/v1/admin/users/${usuarioId}`, {
        method: 'PUT',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, email_confirm: true }),
      })
    } else {
      await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: usuarioId,
          email: peek.email ?? undefined,
          password,
          email_confirm: true,
          user_metadata: { nome: peek.nome, papel: peek.papel === 'Sócio' ? 'socio' : 'advogado' },
        }),
      })
    }

    await rpc('cfg_marcar_usuario_ativo', { p_id: usuarioId })
    if (action === 'confirm-reset') {
      await rpc('cfg_revogar_sessoes', { p_id: usuarioId })
    }

    const session = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: peek.email, password }),
    })
    const sessionJson = await session.json()
    return json({ ok: true, session: sessionJson })
  }

  if (action === 'flush-emails') {
    const provider = Deno.env.get('EMAIL_PROVIDER') ?? 'console'
    const from = Deno.env.get('EMAIL_FROM') ?? 'VERUM <noreply@localhost>'
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const fila = await rpc('cfg_filhos_fila', {})
    const itens = (fila?.itens ?? []) as {
      id: string
      tipo: string
      destinatario: string
      assunto: string
      corpo: string
      payload: { link?: string } | null
    }[]
    for (const item of itens) {
      const link = item.payload?.link
      if (provider === 'resend' && resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [item.destinatario],
            subject: item.assunto,
            text: `${item.corpo}${link ? `\n\n${link}` : ''}`,
          }),
        })
      } else {
        console.info(`[VERUM e-mail/${item.tipo}] ${item.destinatario} ${link ?? item.assunto}`)
      }
      await rpc('cfg_marcar_email_enviado', { p_id: item.id })
    }
    return json({ ok: true, enviados: itens.length, ip })
  }

  return json({ ok: false, message: 'Ação desconhecida.' }, 400)
})
