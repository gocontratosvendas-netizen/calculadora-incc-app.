const CPF_REPETIDO = new Set(
  Array.from({ length: 10 }, (_, i) => String(i).repeat(11)),
)

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D+/g, '')
}

export function cpfValido(valor: string): boolean {
  const cpf = apenasDigitos(valor)
  if (cpf.length !== 11) return false
  if (CPF_REPETIDO.has(cpf)) return false

  const nums = cpf.split('').map((d) => Number(d))
  const dv = (base: number[]) => {
    const soma = base.reduce((acc, n, i) => acc + n * (base.length + 1 - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  if (dv(nums.slice(0, 9)) !== nums[9]) return false
  if (dv(nums.slice(0, 10)) !== nums[10]) return false
  return true
}

/** 123.***.***-00 — nunca revela o miolo. */
export function mascararCpf(valor: string): string {
  const cpf = apenasDigitos(valor).padEnd(11, '*')
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9, 11)}`
}
