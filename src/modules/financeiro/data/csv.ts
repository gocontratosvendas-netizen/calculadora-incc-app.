export function parseCsv(texto: string): { headers: string[]; rows: string[][] } {
  const src = texto.replace(/^\uFEFF/, '')
  const primeira = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (primeira.split(';').length > primeira.split(',').length) ? ';' : ','

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  function commitCell() {
    row.push(cell.trim())
    cell = ''
  }

  function commitRow() {
    commitCell()
    if (row.some((c) => c !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    const next = src[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delimiter) {
      commitCell()
      continue
    }
    if (ch === '\n') {
      commitRow()
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell.length > 0 || row.length > 0) commitRow()

  const headers = rows.shift() ?? []
  return { headers, rows }
}

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
