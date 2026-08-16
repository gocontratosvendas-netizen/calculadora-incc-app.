/** Converte texto em máscara BRL para centavos inteiros. Não usa ponto flutuante na soma. */
export function parseMoedaParaCentavos(texto: string): number | null {
  const semSimbolo = texto.trim().replace(/R\$\s?/gi, '').replace(/\s/g, '')
  if (!semSimbolo) return null

  let normalizado = semSimbolo
  const temVirgula = semSimbolo.includes(',')
  const temPonto = semSimbolo.includes('.')

  if (temVirgula && temPonto) {
    normalizado = semSimbolo.replace(/\./g, '').replace(',', '.')
  } else if (temVirgula) {
    normalizado = semSimbolo.replace(',', '.')
  } else if (temPonto) {
    const partes = semSimbolo.split('.')
    if (partes.length !== 2 || (partes[1] && partes[1].length !== 2)) {
      normalizado = semSimbolo.replace(/\./g, '')
    }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null

  const [reaisBruto, fracBruto = ''] = normalizado.split('.')
  const reais = Number.parseInt(reaisBruto ?? '0', 10)
  const frac = Number.parseInt((fracBruto + '00').slice(0, 2), 10)
  if (!Number.isSafeInteger(reais) || reais < 0) return null
  return reais * 100 + frac
}

export function mascararCentavos(centavos: number): string {
  const abs = Math.abs(Math.trunc(centavos))
  const inteiro = Math.floor(abs / 100)
  const frac = abs % 100
  return `${inteiro.toLocaleString('pt-BR')},${String(frac).padStart(2, '0')}`
}

export function aplicarMascaraDigitacao(texto: string): string {
  const soDigitos = texto.replace(/\D/g, '')
  if (!soDigitos) return ''
  const centavos = Number.parseInt(soDigitos, 10)
  if (!Number.isSafeInteger(centavos)) return texto
  return mascararCentavos(centavos)
}
