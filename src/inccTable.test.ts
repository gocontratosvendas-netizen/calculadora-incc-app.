import { describe, expect, it } from 'vitest'
import {
  aniversariosDecorridos,
  arredondarMoeda,
  calcularFatorCorrecaoPorAniversarios,
  formatarAnoMes,
  mesBaseDoIndice,
} from './inccTable'

function data(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const CONTRATO = data('2023-05-15')

function percentualExibido(fator: number) {
  return Number(((fator - 1) * 100).toFixed(4))
}

describe('defasagem do índice INCC-DI', () => {
  it('recua o índice-base sem mudar o mês do contrato', () => {
    expect(formatarAnoMes(mesBaseDoIndice(CONTRATO, 0))).toBe('mai/2023')
    expect(formatarAnoMes(mesBaseDoIndice(CONTRATO, 1))).toBe('abr/2023')
    expect(formatarAnoMes(mesBaseDoIndice(CONTRATO, 2))).toBe('mar/2023')
    expect(formatarAnoMes(mesBaseDoIndice(CONTRATO, 3))).toBe('fev/2023')
  })

  it('escolhe n pela data de pagamento vs. aniversário, nunca pelo mês do índice', () => {
    expect(aniversariosDecorridos(CONTRATO, data('2023-05-31'))).toBe(0)
    expect(aniversariosDecorridos(CONTRATO, data('2024-01-19'))).toBe(0)
    expect(aniversariosDecorridos(CONTRATO, data('2024-05-15'))).toBe(1)
    expect(aniversariosDecorridos(CONTRATO, data('2024-05-14'))).toBe(0)
    expect(aniversariosDecorridos(CONTRATO, data('2025-03-25'))).toBe(1)
    expect(aniversariosDecorridos(CONTRATO, data('2025-05-15'))).toBe(2)
  })

  it.each([
    { defasagem: 0, n: 1, janela: 'jun/2023 a mai/2024', fatorPct: 4.0292 },
    { defasagem: 0, n: 2, janela: 'jun/2023 a mai/2025', fatorPct: 11.5593 },
    { defasagem: 1, n: 1, janela: 'mai/2023 a abr/2024', fatorPct: 3.7507 },
    { defasagem: 1, n: 2, janela: 'mai/2023 a abr/2025', fatorPct: 11.5704 },
    { defasagem: 2, n: 1, janela: 'abr/2023 a mar/2024', fatorPct: 3.3585 },
    { defasagem: 2, n: 2, janela: 'abr/2023 a mar/2025', fatorPct: 11.1486 },
    { defasagem: 3, n: 1, janela: 'mar/2023 a fev/2024', fatorPct: 3.3791 },
    { defasagem: 3, n: 2, janela: 'mar/2023 a fev/2025', fatorPct: 11.049 },
  ])(
    'defasagem $defasagem n=$n usa $janela ($fatorPct%)',
    ({ defasagem, n, janela, fatorPct }) => {
      const pagamento = n === 1 ? data('2024-07-24') : data('2025-07-10')
      const r = calcularFatorCorrecaoPorAniversarios(CONTRATO, pagamento, defasagem)
      expect(r.erro).toBeNull()
      expect(r.n).toBe(n)
      expect(r.janelaLabel).toBe(janela)
      expect(percentualExibido(r.fator)).toBe(fatorPct)
    },
  )

  it('aborta com o mês ausente e não trata falta de índice como zero', () => {
    const r = calcularFatorCorrecaoPorAniversarios(data('2010-01-15'), data('2011-02-01'), 0)
    expect(r.erro).toMatch(/Falta o índice INCC-DI de fev\/2010/)
    expect(r.fator).toBe(1)
  })
})

describe('regressão contrato 2023-05-15 com defasagem 2', () => {
  const parcelas = [
    { pagamento: '2023-05-31', base: 100_000, n: 0, fatorPct: 0, devido: 100_000, pago: 100_000, excesso: 0 },
    { pagamento: '2024-01-19', base: 40_000, n: 0, fatorPct: 0, devido: 40_000, pago: 40_936.68, excesso: 936.68 },
    { pagamento: '2024-07-24', base: 40_000, n: 1, fatorPct: 3.3585, devido: 41_343.4, pago: 41_915.8, excesso: 572.4 },
    { pagamento: '2025-01-23', base: 40_000, n: 1, fatorPct: 3.3585, devido: 41_343.4, pago: 43_529.53, excesso: 2_186.13 },
    {
      pagamento: '2025-03-25',
      base: 500_000,
      n: 1,
      fatorPct: 3.3585,
      devido: 516_792.56,
      pago: 551_378.77,
      excesso: 34_586.21,
    },
    {
      pagamento: '2025-06-30',
      base: 268_512.55,
      n: 2,
      fatorPct: 11.1486,
      devido: 298_447.96,
      pago: 299_999.99,
      excesso: 1_552.03,
    },
    {
      pagamento: '2025-07-10',
      base: 249_487.45,
      n: 2,
      fatorPct: 11.1486,
      devido: 277_301.82,
      pago: 278_743.89,
      excesso: 1_442.07,
    },
    {
      pagamento: '2025-07-10',
      base: 1_000,
      n: 2,
      fatorPct: 11.1486,
      devido: 1_111.49,
      pago: 1_117.27,
      excesso: 5.78,
    },
  ] as const

  it('produz devido, fator e n de cada parcela', () => {
    const apurados = parcelas.map((p) => {
      const r = calcularFatorCorrecaoPorAniversarios(CONTRATO, data(p.pagamento), 2)
      const devido = arredondarMoeda(p.base * r.fator)
      return {
        ...p,
        nObtido: r.n,
        fatorPctObtido: percentualExibido(r.fator),
        devidoObtido: devido,
        excessoObtido: arredondarMoeda(p.pago - devido),
      }
    })

    for (const p of apurados) {
      expect(p.nObtido, p.pagamento).toBe(p.n)
      expect(p.fatorPctObtido, p.pagamento).toBe(p.fatorPct)
      expect(p.devidoObtido, p.pagamento).toBe(p.devido)
      expect(p.excessoObtido, p.pagamento).toBe(p.excesso)
    }

    expect(arredondarMoeda(apurados.reduce((acc, p) => acc + p.devidoObtido, 0))).toBe(1_316_340.63)
    expect(arredondarMoeda(apurados.reduce((acc, p) => acc + p.excessoObtido, 0))).toBe(41_281.3)
  })

  it('não usa o mês do índice para subir a faixa em 2025-03-25', () => {
    const r = calcularFatorCorrecaoPorAniversarios(CONTRATO, data('2025-03-25'), 2)
    expect(r.n).toBe(1)
    expect(r.janelaLabel).toBe('abr/2023 a mar/2024')
    expect(percentualExibido(r.fator)).toBe(3.3585)
    expect(arredondarMoeda(500_000 * r.fator)).toBe(516_792.56)
  })
})
