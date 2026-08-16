import type { Periodo } from '../types'
import {
  addDias,
  diasInclusivos,
  isAnoCivil,
  isMesCivil,
  isTrimestreCivil,
  mesAnterior,
  partesData,
  periodoDoAno,
  periodoDoMes,
  periodoDoTrimestre,
  trimestreDe,
} from './datas'

export function calcularPeriodoAnterior(periodo: Periodo): Periodo {
  if (isMesCivil(periodo)) {
    const { y, m } = partesData(periodo.inicio)
    const ant = mesAnterior(y, m)
    return periodoDoMes(ant.y, ant.m)
  }
  if (isTrimestreCivil(periodo)) {
    const { y, m } = partesData(periodo.inicio)
    const trimestre = trimestreDe(m)
    if (trimestre === 1) return periodoDoTrimestre(y - 1, 4)
    return periodoDoTrimestre(y, (trimestre - 1) as 1 | 2 | 3 | 4)
  }
  if (isAnoCivil(periodo)) {
    const { y } = partesData(periodo.inicio)
    return periodoDoAno(y - 1)
  }
  const n = diasInclusivos(periodo.inicio, periodo.fim)
  const fimAnterior = addDias(periodo.inicio, -1)
  const inicioAnterior = addDias(fimAnterior, -(n - 1))
  return { inicio: inicioAnterior, fim: fimAnterior }
}
