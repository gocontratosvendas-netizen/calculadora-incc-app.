/** Restrição extra do papel parceiro_juridico: só casos em que é responsável. */
export function casoVisivelPara(input: {
  papelId: string
  usuarioId: string
  responsavelId: string
}): boolean {
  if (input.papelId !== 'parceiro_juridico') return true
  return input.responsavelId === input.usuarioId
}

export function filtrarCasosPorResponsavel<T extends { responsavelId: string }>(
  casos: readonly T[],
  papelId: string,
  usuarioId: string,
): T[] {
  if (papelId !== 'parceiro_juridico') return [...casos]
  return casos.filter((c) => c.responsavelId === usuarioId)
}
