#!/usr/bin/env node
/**
 * Gera links de convite para sócios (papel socio).
 * Uso:
 *   APP_URL=https://seu-app.vercel.app node --env-file=.env.local scripts/convidar-socios.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const appUrl = (process.env.APP_URL || process.argv[2] || '').replace(/\/$/, '')
const adminEmail = process.env.CONVIDAR_COMO_EMAIL || 'vitor@verum.adv.br'
const adminPassword = process.env.CONVIDAR_COMO_SENHA || '123456'

const SOCIOS = [
  { nome: 'Ricardo Bianchi', email: 'ricardobianchi@rbadvogados.com.br' },
  { nome: 'Henry Magnus', email: 'henrymagnus@gmail.com' },
  { nome: 'Georges Eduardo', email: 'georges_capps90@yahoo.com.br' },
  { nome: 'Henrique Barbieri', email: 'henriquebarbieri@outlook.com.br' },
]

if (!url || !anonKey || !serviceKey) {
  console.error('Defina VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!appUrl) {
  console.error('Defina APP_URL (ex.: APP_URL=https://seu-app.vercel.app).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const client = createClient(url, anonKey)

async function convidarViaAdmin(socio) {
  const { data, error } = await admin.rpc('cfg_convidar_usuario_admin', {
    p_nome: socio.nome,
    p_email: socio.email,
    p_papel: 'socio',
  })
  if (error) return { ok: false, message: error.message }
  if (!data?.ok) return { ok: false, message: data?.message || JSON.stringify(data) }
  return { ok: true, link: data.link }
}

async function convidarViaSessao(socio) {
  const { data, error } = await client.rpc('cfg_convidar_usuario', {
    payload: { nome: socio.nome, email: socio.email, papelId: 'socio' },
  })
  if (error) return { ok: false, message: error.message }
  if (!data?.ok) {
    const msg =
      data?.errors?.email ||
      data?.errors?.nome ||
      data?.message ||
      JSON.stringify(data?.errors ?? data)
    return { ok: false, message: msg }
  }
  return { ok: true, link: null }
}

async function main() {
  if (/localhost|127\.0\.0\.1/.test(url)) {
    console.warn(
      '⚠️  VITE_SUPABASE_URL aponta para Supabase LOCAL. Para convites de produção, use .env com o projeto remoto (jupvqqsnvdvfceklaztl.supabase.co).\n',
    )
  }
  const { error: urlError } = await admin.rpc('cfg_definir_app_url', { p_url: appUrl })
  if (urlError) {
    console.error('Não foi possível definir APP_URL:', urlError.message)
    process.exit(1)
  }
  console.log(`APP_URL definida: ${appUrl}\n`)

  const { error: loginError } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  const sessaoOk = !loginError

  const links = []

  for (const socio of SOCIOS) {
    let result = await convidarViaAdmin(socio)
    if (!result.ok && sessaoOk) result = await convidarViaSessao(socio)

    if (!result.ok) {
      console.error(`✗ ${socio.nome} — ${result.message}`)
      continue
    }

    console.log(`✓ Convite criado: ${socio.nome} (${socio.email})`)
    if (result.link) links.push({ nome: socio.nome, link: result.link })
  }

  if (links.length < SOCIOS.length) {
    const { data: fila } = await admin.rpc('cfg_filhos_fila')
    const porEmail = new Map(
      (fila?.itens ?? [])
        .filter((item) => item.tipo === 'convite' && item.payload?.link)
        .map((item) => [String(item.destinatario).toLowerCase(), item.payload.link]),
    )
    for (const socio of SOCIOS) {
      if (links.some((l) => l.nome === socio.nome)) continue
      const link = porEmail.get(socio.email.toLowerCase())
      if (link) links.push({ nome: socio.nome, link })
    }
  }

  console.log('\n--- Links de cadastro (válidos por 7 dias) ---\n')
  for (const socio of SOCIOS) {
    const item = links.find((l) => l.nome === socio.nome)
    if (item) {
      console.log(`${item.nome}`)
      console.log(`${item.link}\n`)
    } else {
      console.log(`${socio.nome} — link não gerado\n`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
