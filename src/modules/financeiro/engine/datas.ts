import type { Periodo } from '../types'

export function partesData(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y: y ?? 0, m: m ?? 0, d: d ?? 0 }
}

export function isoDe(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function hojeISO(agora = new Date()): string {
  return isoDe(agora.getFullYear(), agora.getMonth() + 1, agora.getDate())
}

export function dataNoIntervalo(data: string, inicio: string, fim: string): boolean {
  return data >= inicio && data <= fim
}

export function diasNoMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function ultimoDiaDoMes(y: number, m: number): string {
  return isoDe(y, m, diasNoMes(y, m))
}

export function addDias(iso: string, dias: number): string {
  const { y, m, d } = partesData(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return isoDe(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function diasInclusivos(inicio: string, fim: string): number {
  const a = partesData(inicio)
  const b = partesData(fim)
  const da = Date.UTC(a.y, a.m - 1, a.d)
  const db = Date.UTC(b.y, b.m - 1, b.d)
  return Math.round((db - da) / 86_400_000) + 1
}

export function periodoDoMes(y: number, m: number): Periodo {
  return { inicio: isoDe(y, m, 1), fim: ultimoDiaDoMes(y, m) }
}

export function periodoDoTrimestre(y: number, trimestre: 1 | 2 | 3 | 4): Periodo {
  const mesInicio = (trimestre - 1) * 3 + 1
  const mesFim = mesInicio + 2
  return { inicio: isoDe(y, mesInicio, 1), fim: ultimoDiaDoMes(y, mesFim) }
}

export function periodoDoAno(y: number): Periodo {
  return { inicio: isoDe(y, 1, 1), fim: isoDe(y, 12, 31) }
}

export function isMesCivil(periodo: Periodo): boolean {
  const i = partesData(periodo.inicio)
  const f = partesData(periodo.fim)
  return i.d === 1 && i.y === f.y && i.m === f.m && periodo.fim === ultimoDiaDoMes(i.y, i.m)
}

export function isTrimestreCivil(periodo: Periodo): boolean {
  const i = partesData(periodo.inicio)
  if (i.d !== 1 || ![1, 4, 7, 10].includes(i.m)) return false
  const trimestre = (Math.floor((i.m - 1) / 3) + 1) as 1 | 2 | 3 | 4
  const esperado = periodoDoTrimestre(i.y, trimestre)
  return periodo.inicio === esperado.inicio && periodo.fim === esperado.fim
}

export function isAnoCivil(periodo: Periodo): boolean {
  const i = partesData(periodo.inicio)
  return periodo.inicio === isoDe(i.y, 1, 1) && periodo.fim === isoDe(i.y, 12, 31)
}

export function mesAnterior(y: number, m: number): { y: number; m: number } {
  if (m === 1) return { y: y - 1, m: 12 }
  return { y, m: m - 1 }
}

export function trimestreDe(m: number): 1 | 2 | 3 | 4 {
  return (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4
}
