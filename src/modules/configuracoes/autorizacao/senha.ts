const SEQUENCIAS = [
  '012345678901',
  '123456789012',
  '987654321098',
  'abcdefghijkl',
  'qwertyuiopas',
]

const PALAVRAS = [
  'password',
  'password123',
  'senha1234567',
  'senhasenha12',
  'verum1234567',
  'admin1234567',
  'convidado123',
  'abcdefghijkl',
]

export function senhaAceita(senha: string): { ok: true } | { ok: false; motivo: string } {
  if (senha.length < 12) {
    return { ok: false, motivo: 'A senha deve ter no mínimo 12 caracteres.' }
  }
  const lower = senha.toLowerCase()
  if (PALAVRAS.some((p) => lower.includes(p))) {
    return { ok: false, motivo: 'Escolha uma senha menos óbvia.' }
  }
  if (SEQUENCIAS.some((s) => lower.includes(s))) {
    return { ok: false, motivo: 'Escolha uma senha menos óbvia.' }
  }
  if (/^(.)\1{11,}$/.test(senha)) {
    return { ok: false, motivo: 'Escolha uma senha menos óbvia.' }
  }
  if (!/\d/.test(senha) || !/[A-Za-z]/.test(senha)) {
    return { ok: false, motivo: 'A senha deve combinar letras e números.' }
  }
  return { ok: true }
}

export function senhasConferem(senha: string, confirmacao: string): boolean {
  return senha === confirmacao
}
