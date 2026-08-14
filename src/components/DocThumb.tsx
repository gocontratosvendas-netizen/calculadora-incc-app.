import type { ThumbVariant } from '../lib/materiais'
import { resolverThumb } from '../lib/materiais'

export function DocThumb({ variant }: { variant: ThumbVariant }) {
  switch (resolverThumb(variant)) {
    case 'carta-bloco':
      return (
        <svg viewBox="0 0 66 90" width="66" height="90" role="img" aria-label="Documento com bloco destacado">
          <rect x="0.25" y="0.25" width="65.5" height="89.5" rx="2" fill="#FFFFFF" stroke="#DCD8D0" strokeWidth="0.5" />
          <rect x="8" y="9" width="35" height="3" fill="#132339" />
          <rect x="8" y="19" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="25" width="44" height="2" fill="#E2DFD8" />
          <rect x="8" y="36" width="50" height="14" fill="#F1EFE8" />
          <rect x="8" y="56" width="47" height="2" fill="#E2DFD8" />
          <rect x="8" y="62" width="39" height="2" fill="#E2DFD8" />
        </svg>
      )
    case 'tabela':
      return (
        <svg viewBox="0 0 66 90" width="66" height="90" role="img" aria-label="Documento do tipo tabela">
          <rect x="0.25" y="0.25" width="65.5" height="89.5" rx="2" fill="#FFFFFF" stroke="#DCD8D0" strokeWidth="0.5" />
          <rect x="8" y="9" width="26" height="3" fill="#132339" />
          <rect x="8" y="19" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="25" width="45" height="2" fill="#E2DFD8" />
          <rect x="8" y="34" width="15.3" height="9" fill="#EAE7E0" />
          <rect x="25.3" y="34" width="15.3" height="9" fill="#EAE7E0" />
          <rect x="42.7" y="34" width="15.3" height="9" fill="#EAE7E0" />
          <rect x="8" y="47" width="15.3" height="9" fill="#F1EFE8" />
          <rect x="25.3" y="47" width="15.3" height="9" fill="#F1EFE8" />
          <rect x="42.7" y="47" width="15.3" height="9" fill="#F1EFE8" />
          <rect x="8" y="60" width="15.3" height="9" fill="#F1EFE8" />
          <rect x="25.3" y="60" width="15.3" height="9" fill="#F1EFE8" />
          <rect x="42.7" y="60" width="15.3" height="9" fill="#F1EFE8" />
        </svg>
      )
    case 'checklist':
      return (
        <svg viewBox="0 0 66 90" width="66" height="90" role="img" aria-label="Documento do tipo checklist">
          <rect x="0.25" y="0.25" width="65.5" height="89.5" rx="2" fill="#FFFFFF" stroke="#DCD8D0" strokeWidth="0.5" />
          <rect x="8" y="9" width="32" height="3" fill="#132339" />
          <rect x="8.25" y="20.25" width="3.5" height="3.5" fill="none" stroke="#C9C5BC" strokeWidth="0.5" />
          <rect x="16" y="21" width="40" height="2" fill="#E2DFD8" />
          <rect x="8.25" y="28.25" width="3.5" height="3.5" fill="none" stroke="#C9C5BC" strokeWidth="0.5" />
          <rect x="16" y="29" width="35" height="2" fill="#E2DFD8" />
          <rect x="8.25" y="36.25" width="3.5" height="3.5" fill="none" stroke="#C9C5BC" strokeWidth="0.5" />
          <rect x="16" y="37" width="42" height="2" fill="#E2DFD8" />
          <rect x="8.25" y="44.25" width="3.5" height="3.5" fill="none" stroke="#C9C5BC" strokeWidth="0.5" />
          <rect x="16" y="45" width="31" height="2" fill="#E2DFD8" />
          <rect x="8.25" y="52.25" width="3.5" height="3.5" fill="none" stroke="#C9C5BC" strokeWidth="0.5" />
          <rect x="16" y="53" width="37" height="2" fill="#E2DFD8" />
        </svg>
      )
    case 'memorando':
      return (
        <svg viewBox="0 0 66 90" width="66" height="90" role="img" aria-label="Documento do tipo memorando">
          <rect x="0.25" y="0.25" width="65.5" height="89.5" rx="2" fill="#FFFFFF" stroke="#DCD8D0" strokeWidth="0.5" />
          <rect x="8" y="9" width="22" height="2" fill="#E2DFD8" />
          <rect x="8" y="17" width="36" height="3" fill="#132339" />
          <rect x="8" y="27" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="33" width="48" height="2" fill="#E2DFD8" />
          <rect x="8" y="39" width="44" height="2" fill="#E2DFD8" />
          <rect x="8" y="51" width="20" height="2" fill="#E2DFD8" />
        </svg>
      )
    case 'relatorio':
      return (
        <svg viewBox="0 0 66 90" width="66" height="90" role="img" aria-label="Documento do tipo relatório">
          <rect x="0.25" y="0.25" width="65.5" height="89.5" rx="2" fill="#FFFFFF" stroke="#DCD8D0" strokeWidth="0.5" />
          <rect x="8" y="9" width="29" height="3" fill="#132339" />
          <rect x="8" y="19" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="25" width="46.5" height="2" fill="#E2DFD8" />
          <rect x="8" y="31" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="37" width="32" height="2" fill="#E2DFD8" />
          <rect x="8" y="48" width="49" height="2" fill="#E2DFD8" />
          <rect x="8" y="54" width="36" height="2" fill="#E2DFD8" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 66 90" width="66" height="90" role="img" aria-label="Documento do tipo carta">
          <rect x="0.25" y="0.25" width="65.5" height="89.5" rx="2" fill="#FFFFFF" stroke="#DCD8D0" strokeWidth="0.5" />
          <rect x="8" y="9" width="30" height="3" fill="#132339" />
          <rect x="8" y="19" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="25" width="46" height="2" fill="#E2DFD8" />
          <rect x="8" y="31" width="48" height="2" fill="#E2DFD8" />
          <rect x="8" y="37" width="35" height="2" fill="#E2DFD8" />
          <rect x="8" y="48" width="50" height="2" fill="#E2DFD8" />
          <rect x="8" y="54" width="42" height="2" fill="#E2DFD8" />
        </svg>
      )
  }
}
