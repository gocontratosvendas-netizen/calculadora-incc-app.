import { publicarPost } from './mural'
import { getSessionUserId, supabase, uploadFile, type Profile } from './supabase'

export type CasoStatus =
  | 'stand_by'
  | 'processo_de_venda'
  | 'confeccao_de_peticao_inicial'
  | 'ajuizado'
  | 'encerrado'

export interface Caso {
  id: string
  cliente: string
  empreendimento: string
  incorporadora: string
  valorContrato: number
  excessoApurado: number | null
  valorCausa: number | null
  /** Percentual de honorários de êxito (10, 20, 30…). */
  percentualExito: number
  anoAjuizamento: number | null
  status: CasoStatus
  responsavel: { nome: string; iniciais: string }
  atualizadoEm: string
}

export interface CarteiraResumo {
  casosCadastrados: number
  emAndamento: number
  valorTotalCausa: number
  excessoTotalCarteira: number
  recuperado: number
}

export interface CarteiraFinanceiro {
  /** Soma dos lançamentos de pró-labore da área financeira, em reais. */
  proLaboreRecebido: number
  /** Soma dos honorários de êxito esperados (percentual de cada caso × valor da causa). */
  honorariosExitoEsperados: number
}

export const PERCENTUAIS_EXITO = [10, 20, 30] as const
export const PERCENTUAL_EXITO_PADRAO = 30
export const HONORARIOS_EXITO_PERCENTUAL = PERCENTUAL_EXITO_PADRAO / 100

export function percentualExitoValido(valor: number): boolean {
  return (PERCENTUAIS_EXITO as readonly number[]).includes(valor)
}

export function honorariosExitoDoCaso(
  valorCausa: number | null,
  percentualExito: number,
): number | null {
  if (valorCausa == null) return null
  return valorCausa * (percentualExito / 100)
}

/** Fases em que o caso já segue para o Judiciário e entra nos gráficos da carteira. */
export const STATUS_CARTEIRA_JUDICIAL: readonly CasoStatus[] = [
  'confeccao_de_peticao_inicial',
  'ajuizado',
  'encerrado',
]

export function casoEntraNaCarteiraJudicial(status: CasoStatus): boolean {
  return (STATUS_CARTEIRA_JUDICIAL as readonly string[]).includes(status)
}

function casosDaCarteiraJudicial(casos: Caso[]): Caso[] {
  return casos.filter((caso) => casoEntraNaCarteiraJudicial(caso.status))
}

export function calcularResumoCarteira(casos: Caso[]): CarteiraResumo {
  const base = casosDaCarteiraJudicial(casos)
  let emAndamento = 0
  let valorTotalCausa = 0
  let excessoTotalCarteira = 0
  let recuperado = 0

  for (const caso of base) {
    if (caso.status !== 'encerrado') {
      emAndamento += 1
    }
    if (caso.valorCausa != null) {
      valorTotalCausa += caso.valorCausa
    }
    if (caso.excessoApurado != null) {
      excessoTotalCarteira += caso.excessoApurado
    }
    if (caso.status === 'encerrado' && caso.excessoApurado != null) {
      recuperado += caso.excessoApurado
    }
  }

  return {
    casosCadastrados: base.length,
    emAndamento,
    valorTotalCausa,
    excessoTotalCarteira,
    recuperado,
  }
}

export function calcularResumoFinanceiro(
  casos: Caso[],
  proLaboreRecebido = 0,
): CarteiraFinanceiro {
  const base = casosDaCarteiraJudicial(casos)
  let honorariosExitoEsperados = 0

  for (const caso of base) {
    const esperado = honorariosExitoDoCaso(caso.valorCausa, caso.percentualExito)
    if (esperado != null) honorariosExitoEsperados += esperado
  }

  return {
    proLaboreRecebido,
    honorariosExitoEsperados,
  }
}

type CasoRow = {
  id: string
  cliente_nome: string
  cliente_email: string | null
  cliente_telefone: string | null
  empreendimento: string
  incorporadora: string
  data_assinatura: string | null
  valor_contrato: number
  parcelas_reais: number
  parcelas_contrato: number
  parcela_residual: number | null
  situacao_obra: 'em_andamento' | 'entregue'
  data_chaves: string | null
  excesso_apurado: number | null
  valor_causa: number | null
  percentual_exito: number | string | null
  prescricao_em: string | null
  status: CasoStatus
  numero_processo: string | null
  data_protocolo: string | null
  vara_comarca: string | null
  desfecho: Desfecho | null
  valor_recuperado: number | null
  parceiro_id: string | null
  canal_origem: string
  responsavel_id: string
  criterios: { rotulo: string; atendido: boolean }[] | null
  atualizado_em: string
  responsavel?: Profile | Profile[] | null
  parceiro?: { id: string; nome: string; iniciais: string } | { id: string; nome: string; iniciais: string }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null
  return typeof value === 'number' ? value : Number(value)
}

function mapCasoLista(row: CasoRow): Caso {
  const responsavel = one(row.responsavel)
  return {
    id: row.id,
    cliente: row.cliente_nome,
    empreendimento: row.empreendimento,
    incorporadora: row.incorporadora,
    valorContrato: Number(row.valor_contrato),
    excessoApurado: num(row.excesso_apurado),
    valorCausa: num(row.valor_causa),
    percentualExito: Math.round(num(row.percentual_exito) ?? PERCENTUAL_EXITO_PADRAO),
    anoAjuizamento: row.data_protocolo ? Number(row.data_protocolo.slice(0, 4)) : null,
    status: row.status,
    responsavel: {
      nome: responsavel?.nome ?? '—',
      iniciais: responsavel?.iniciais ?? '—',
    },
    atualizadoEm: row.atualizado_em,
  }
}

export type NovoCasoInput = {
  cliente: string
  empreendimento?: string
  incorporadora?: string
  valorContrato: number
  excessoApurado: number | null
  valorCausa: number | null
  memoriaRevisaoIncc?: File | null
}

export const ROTULO_MEMORIA_REVISAO_INCC = 'Memória de Cálculo Revisão INCC'

const DOCUMENTOS_PADRAO: { chave: DocumentoChave; rotulo: string; obrigatorio: boolean }[] = [
  { chave: 'memoria_revisao_incc', rotulo: ROTULO_MEMORIA_REVISAO_INCC, obrigatorio: false },
  { chave: 'memorial', rotulo: 'Memorial de cálculo da incorporadora', obrigatorio: true },
  { chave: 'contrato', rotulo: 'Contrato de compra e venda', obrigatorio: true },
  { chave: 'chaves', rotulo: 'Termo de entrega de chaves', obrigatorio: false },
  { chave: 'comprovantes', rotulo: 'Comprovantes de pagamento', obrigatorio: false },
]

export const ORDEM_DOCUMENTOS_CASO: DocumentoChave[] = DOCUMENTOS_PADRAO.map((doc) => doc.chave)

export function isDocumentoPadrao(chave: string): chave is DocumentoChave {
  return (ORDEM_DOCUMENTOS_CASO as readonly string[]).includes(chave)
}

function criteriosPadrao(excesso: number | null, status: CasoStatus) {
  return [
    { rotulo: 'Parcelas reais inferiores às do contrato', atendido: excesso != null },
    {
      rotulo: 'Obra entregue',
      atendido:
        (status !== 'stand_by' && status !== 'processo_de_venda') || excesso != null,
    },
    { rotulo: 'Dentro do prazo prescricional', atendido: true },
    { rotulo: 'Memorial de cálculo disponível', atendido: excesso != null },
    { rotulo: 'Excesso apurado', atendido: excesso != null },
  ]
}

export async function listarCasos(): Promise<Caso[]> {
  const { data, error } = await supabase
    .from('casos')
    .select(
      'id, cliente_nome, empreendimento, incorporadora, valor_contrato, excesso_apurado, valor_causa, percentual_exito, data_protocolo, status, atualizado_em, responsavel:profiles!casos_responsavel_id_fkey(id, nome, iniciais)',
    )
    .order('atualizado_em', { ascending: false })
  if (error) throw error
  return (data as CasoRow[]).map(mapCasoLista)
}

export async function obterResumoCarteira(): Promise<CarteiraResumo> {
  const casos = await listarCasos()
  return calcularResumoCarteira(casos)
}

export async function listarOpcoesClienteCaso(): Promise<
  { id: string; nome: string; empreendimento: string }[]
> {
  const { data, error } = await supabase
    .from('casos')
    .select('id, cliente_nome, empreendimento')
    .order('cliente_nome')
  if (error) throw error
  return ((data ?? []) as { id: string; cliente_nome: string; empreendimento: string }[]).map(
    (row) => ({
      id: row.id,
      nome: row.cliente_nome,
      empreendimento: row.empreendimento,
    }),
  )
}

export async function atualizarPercentualExito(
  casoId: string,
  percentual: number,
): Promise<void> {
  if (!percentualExitoValido(percentual)) {
    throw new Error('Percentual de êxito inválido.')
  }
  const { error } = await supabase
    .from('casos')
    .update({ percentual_exito: percentual, atualizado_em: new Date().toISOString() })
    .eq('id', casoId)
  if (error) throw error
}

export async function cadastrarCaso(input: NovoCasoInput): Promise<Caso> {
  const cliente = input.cliente.trim()
  if (!cliente) throw new Error('Informe o nome do cliente')

  const userId = await getSessionUserId()
  const id = `caso-${crypto.randomUUID()}`
  const criterios = criteriosPadrao(input.excessoApurado, 'processo_de_venda')

  const { data, error } = await supabase
    .from('casos')
    .insert({
      id,
      cliente_nome: cliente,
      empreendimento: input.empreendimento?.trim() || 'A definir',
      incorporadora: input.incorporadora?.trim() || 'A definir',
      valor_contrato: input.valorContrato,
      excesso_apurado: input.excessoApurado,
      valor_causa: input.valorCausa,
      status: 'processo_de_venda',
      responsavel_id: userId,
      criterios,
      atualizado_em: new Date().toISOString(),
    })
    .select(
      'id, cliente_nome, empreendimento, incorporadora, valor_contrato, excesso_apurado, valor_causa, percentual_exito, data_protocolo, status, atualizado_em, responsavel:profiles!casos_responsavel_id_fkey(id, nome, iniciais)',
    )
    .single()
  if (error) throw error

  const { error: docsError } = await supabase.from('documentos_caso').insert(
    DOCUMENTOS_PADRAO.map((doc) => ({
      id: `doc-${id}-${doc.chave}`,
      caso_id: id,
      chave: doc.chave,
      rotulo: doc.rotulo,
      obrigatorio: doc.obrigatorio,
    })),
  )
  if (docsError) {
    await supabase.from('casos').delete().eq('id', id)
    throw docsError
  }

  if (input.memoriaRevisaoIncc) {
    try {
      await anexarDocumento(id, 'memoria_revisao_incc', input.memoriaRevisaoIncc)
    } catch (memoriaError) {
      await supabase.from('casos').delete().eq('id', id)
      throw memoriaError
    }
  }

  const { error: andamentoError } = await supabase.from('andamentos').insert({
    id: `and-${crypto.randomUUID()}`,
    caso_id: id,
    tipo: 'sistema',
    titulo: 'Caso cadastrado',
    descricao: null,
    data: new Date().toISOString().slice(0, 10),
    autor_id: userId,
    automatico: true,
  })
  if (andamentoError) {
    await supabase.from('casos').delete().eq('id', id)
    throw andamentoError
  }

  return mapCasoLista(data as CasoRow)
}

export async function excluirCaso(id: string): Promise<void> {
  const { error } = await supabase.from('casos').delete().eq('id', id)
  if (error) throw error
}

export type TipoAndamento =
  | 'contato'
  | 'documento'
  | 'calculo'
  | 'protocolo'
  | 'decisao'
  | 'prazo'
  | 'financeiro'
  | 'status'
  | 'sistema'

export type TipoAndamentoManual = Exclude<TipoAndamento, 'status' | 'sistema'>

export type Desfecho =
  | 'procedente'
  | 'parcialmente_procedente'
  | 'improcedente'
  | 'acordo'
  | 'desistencia'

export type DocumentoChave =
  | 'memoria_revisao_incc'
  | 'memorial'
  | 'contrato'
  | 'chaves'
  | 'comprovantes'

export interface AndamentoAutor {
  id: string
  nome: string
  iniciais: string
}

export interface AndamentoAnexo {
  id: string
  nome: string
  tamanhoBytes: number
  url: string
}

export interface Andamento {
  id: string
  tipo: TipoAndamento
  titulo: string
  descricao: string | null
  data: string
  autor: AndamentoAutor
  anexo: AndamentoAnexo | null
  acao: { rotulo: string; destino: string } | null
  automatico: boolean
  criadoEm: string
}

export interface Prazo {
  id: string
  titulo: string
  descricao: string | null
  venceEm: string
  concluido: boolean
  concluidoEm: string | null
}

export interface DocumentoCaso {
  chave: DocumentoChave | string
  rotulo: string
  obrigatorio: boolean
  arquivo: AndamentoAnexo | null
}

export interface CasoDetalhe {
  id: string
  cliente: { nome: string; email: string | null; telefone: string | null }
  empreendimento: string
  incorporadora: string
  dataAssinatura: string
  valorContrato: number
  parcelasReais: number
  parcelasContrato: number
  parcelaResidual: number | null
  situacaoObra: 'em_andamento' | 'entregue'
  dataChaves: string | null
  excessoApurado: number | null
  valorCausa: number | null
  percentualExito: number
  prescricaoEm: string | null
  status: CasoStatus
  numeroProcesso: string | null
  dataProtocolo: string | null
  varaComarca: string | null
  desfecho: Desfecho | null
  valorRecuperado: number | null
  parceiro: { id: string; nome: string; iniciais: string } | null
  canalOrigem: string
  responsavel: { id: string; nome: string; iniciais: string }
  enquadramento: {
    criteriosAtendidos: number
    criterios: { rotulo: string; atendido: boolean }[]
  }
  andamentos: Andamento[]
  prazos: Prazo[]
  documentos: DocumentoCaso[]
}

export interface RegistrarAndamentoInput {
  tipo: TipoAndamentoManual
  titulo: string
  descricao: string | null
  data: string
  anexo: File | null
  criarPrazo: boolean
  dataPrazo: string | null
}

export interface EditarAndamentoInput {
  tipo: TipoAndamentoManual
  titulo: string
  descricao: string | null
  data: string
  anexo: File | null
}

export interface MudarStatusInput {
  status: CasoStatus
  dataMudanca: string
  observacao: string | null
  numeroProcesso?: string | null
  dataProtocolo?: string | null
  valorCausa?: number | null
  varaComarca?: string | null
  desfecho?: Desfecho | null
  valorRecuperado?: number | null
  dataDesfecho?: string | null
}

export const STATUS_CASO_LISTA: CasoStatus[] = [
  'stand_by',
  'processo_de_venda',
  'confeccao_de_peticao_inicial',
  'ajuizado',
  'encerrado',
]

export const STATUS_CASO_ROTULO: Record<CasoStatus, string> = {
  stand_by: 'Stand-by',
  processo_de_venda: 'Processo de venda',
  confeccao_de_peticao_inicial: 'Confecção de Petição Inicial',
  ajuizado: 'Ajuizado',
  encerrado: 'Encerrado',
}

export const DESFECHO_ROTULO: Record<Desfecho, string> = {
  procedente: 'Procedente',
  parcialmente_procedente: 'Parcialmente procedente',
  improcedente: 'Improcedente',
  acordo: 'Acordo',
  desistencia: 'Desistência',
}

export const TIPOS_ANDAMENTO_MANUAIS: TipoAndamentoManual[] = [
  'contato',
  'documento',
  'calculo',
  'protocolo',
  'decisao',
  'prazo',
  'financeiro',
]

export const TIPO_ANDAMENTO_ROTULO: Record<TipoAndamento, string> = {
  contato: 'Contato',
  documento: 'Documento',
  calculo: 'Cálculo',
  protocolo: 'Protocolo',
  decisao: 'Decisão',
  prazo: 'Prazo',
  financeiro: 'Financeiro',
  status: 'Status',
  sistema: 'Sistema',
}

type AndamentoRow = {
  id: string
  tipo: TipoAndamento
  titulo: string
  descricao: string | null
  data: string
  autor_id: string
  anexo_id: string | null
  anexo_nome: string | null
  anexo_tamanho_bytes: number | null
  anexo_url: string | null
  acao_rotulo: string | null
  acao_destino: string | null
  automatico: boolean
  criado_em: string
  autor?: Profile | Profile[] | null
}

type PrazoRow = {
  id: string
  titulo: string
  descricao: string | null
  vence_em: string
  concluido: boolean
  concluido_em: string | null
}

type DocRow = {
  chave: string
  rotulo: string
  obrigatorio: boolean
  arquivo_id: string | null
  arquivo_nome: string | null
  arquivo_tamanho_bytes: number | null
  arquivo_url: string | null
}

function mapAndamento(row: AndamentoRow): Andamento {
  const autor = one(row.autor)
  return {
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    descricao: row.descricao,
    data: row.data,
    autor: {
      id: autor?.id ?? row.autor_id,
      nome: autor?.nome ?? '—',
      iniciais: autor?.iniciais ?? '—',
    },
    anexo:
      row.anexo_id && row.anexo_nome && row.anexo_url
        ? {
            id: row.anexo_id,
            nome: row.anexo_nome,
            tamanhoBytes: Number(row.anexo_tamanho_bytes ?? 0),
            url: row.anexo_url,
          }
        : null,
    acao:
      row.acao_rotulo && row.acao_destino
        ? { rotulo: row.acao_rotulo, destino: row.acao_destino }
        : null,
    automatico: row.automatico,
    criadoEm: row.criado_em,
  }
}

function mapPrazo(row: PrazoRow): Prazo {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    venceEm: row.vence_em,
    concluido: row.concluido,
    concluidoEm: row.concluido_em,
  }
}

function mapDocumento(row: DocRow): DocumentoCaso {
  return {
    chave: row.chave,
    rotulo: row.rotulo,
    obrigatorio: row.obrigatorio,
    arquivo:
      row.arquivo_id && row.arquivo_nome && row.arquivo_url
        ? {
            id: row.arquivo_id,
            nome: row.arquivo_nome,
            tamanhoBytes: Number(row.arquivo_tamanho_bytes ?? 0),
            url: row.arquivo_url,
          }
        : null,
  }
}

function normalizarDocumentos(documentos: DocumentoCaso[]): DocumentoCaso[] {
  const porChave = new Map(documentos.map((doc) => [doc.chave, doc]))
  const padrao = DOCUMENTOS_PADRAO.flatMap((item) => {
    const existente = porChave.get(item.chave)
    if (!existente) return []
    return [
      {
        ...existente,
        rotulo: item.rotulo,
        obrigatorio: item.obrigatorio,
      },
    ]
  })
  const extras = documentos.filter((doc) => !isDocumentoPadrao(doc.chave))
  return [...padrao, ...extras]
}

async function uploadAnexoCaso(casoId: string, arquivo: File) {
  const id = crypto.randomUUID()
  const path = `${casoId}/${id}-${arquivo.name}`
  const uploaded = await uploadFile('casos-arquivos', path, arquivo)
  return {
    id,
    nome: arquivo.name,
    tamanhoBytes: arquivo.size,
    url: uploaded.url,
  }
}

export async function obterCaso(id: string): Promise<CasoDetalhe> {
  const { data: row, error } = await supabase
    .from('casos')
    .select(
      `*,
      responsavel:profiles!casos_responsavel_id_fkey(id, nome, iniciais),
      parceiro:parceiros(id, nome, iniciais)`,
    )
    .eq('id', id)
    .single()
  if (error) throw error

  const caso = row as CasoRow
  const responsavel = one(caso.responsavel)
  const parceiro = one(caso.parceiro)
  const criterios = caso.criterios?.length
    ? caso.criterios
    : criteriosPadrao(num(caso.excesso_apurado), caso.status)

  const [{ data: andamentos }, { data: prazos }, { data: documentos }] = await Promise.all([
    supabase
      .from('andamentos')
      .select('*, autor:profiles!andamentos_autor_id_fkey(id, nome, iniciais)')
      .eq('caso_id', id)
      .order('criado_em', { ascending: false }),
    supabase.from('prazos').select('*').eq('caso_id', id).order('vence_em'),
    supabase.from('documentos_caso').select('*').eq('caso_id', id),
  ])

  return {
    id: caso.id,
    cliente: {
      nome: caso.cliente_nome,
      email: caso.cliente_email,
      telefone: caso.cliente_telefone,
    },
    empreendimento: caso.empreendimento,
    incorporadora: caso.incorporadora,
    dataAssinatura: caso.data_assinatura ?? caso.atualizado_em.slice(0, 10),
    valorContrato: Number(caso.valor_contrato),
    parcelasReais: caso.parcelas_reais,
    parcelasContrato: caso.parcelas_contrato,
    parcelaResidual: num(caso.parcela_residual),
    situacaoObra: caso.situacao_obra,
    dataChaves: caso.data_chaves,
    excessoApurado: num(caso.excesso_apurado),
    valorCausa: num(caso.valor_causa),
    percentualExito: Math.round(num(caso.percentual_exito) ?? PERCENTUAL_EXITO_PADRAO),
    prescricaoEm: caso.prescricao_em,
    status: caso.status,
    numeroProcesso: caso.numero_processo,
    dataProtocolo: caso.data_protocolo,
    varaComarca: caso.vara_comarca,
    desfecho: caso.desfecho,
    valorRecuperado: num(caso.valor_recuperado),
    parceiro: parceiro ? { id: parceiro.id, nome: parceiro.nome, iniciais: parceiro.iniciais } : null,
    canalOrigem: caso.canal_origem,
    responsavel: {
      id: responsavel?.id ?? caso.responsavel_id,
      nome: responsavel?.nome ?? '—',
      iniciais: responsavel?.iniciais ?? '—',
    },
    enquadramento: {
      criteriosAtendidos: criterios.filter((c) => c.atendido).length,
      criterios,
    },
    andamentos: ((andamentos ?? []) as AndamentoRow[]).map(mapAndamento),
    prazos: ((prazos ?? []) as PrazoRow[]).map(mapPrazo),
    documentos: normalizarDocumentos(((documentos ?? []) as DocRow[]).map(mapDocumento)),
  }
}

export async function registrarAndamento(
  casoId: string,
  input: RegistrarAndamentoInput,
): Promise<Andamento> {
  const userId = await getSessionUserId()
  const anexo = input.anexo ? await uploadAnexoCaso(casoId, input.anexo) : null
  const id = `and-${crypto.randomUUID()}`

  const { data, error } = await supabase
    .from('andamentos')
    .insert({
      id,
      caso_id: casoId,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      data: input.data,
      autor_id: userId,
      anexo_id: anexo?.id ?? null,
      anexo_nome: anexo?.nome ?? null,
      anexo_tamanho_bytes: anexo?.tamanhoBytes ?? null,
      anexo_url: anexo?.url ?? null,
      automatico: false,
    })
    .select('*, autor:profiles!andamentos_autor_id_fkey(id, nome, iniciais)')
    .single()
  if (error) throw error

  if (input.criarPrazo && input.dataPrazo) {
    await supabase.from('prazos').insert({
      id: `prz-${crypto.randomUUID()}`,
      caso_id: casoId,
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      vence_em: input.dataPrazo,
      concluido: false,
    })
  }

  await supabase
    .from('casos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', casoId)

  return mapAndamento(data as AndamentoRow)
}

export async function editarAndamento(
  andamentoId: string,
  input: EditarAndamentoInput,
): Promise<Andamento> {
  const { data: existing, error: findError } = await supabase
    .from('andamentos')
    .select('caso_id')
    .eq('id', andamentoId)
    .single()
  if (findError) throw findError

  const patch: Record<string, unknown> = {
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || null,
    data: input.data,
  }

  if (input.anexo) {
    const anexo = await uploadAnexoCaso(existing.caso_id, input.anexo)
    patch.anexo_id = anexo.id
    patch.anexo_nome = anexo.nome
    patch.anexo_tamanho_bytes = anexo.tamanhoBytes
    patch.anexo_url = anexo.url
  }

  const { data, error } = await supabase
    .from('andamentos')
    .update(patch)
    .eq('id', andamentoId)
    .select('*, autor:profiles!andamentos_autor_id_fkey(id, nome, iniciais)')
    .single()
  if (error) throw error

  await supabase
    .from('casos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', existing.caso_id)

  return mapAndamento(data as AndamentoRow)
}

export async function mudarStatus(casoId: string, input: MudarStatusInput): Promise<CasoDetalhe> {
  const userId = await getSessionUserId()
  const patch: Record<string, unknown> = {
    status: input.status,
    atualizado_em: new Date().toISOString(),
  }

  if (input.status === 'ajuizado') {
    if (input.numeroProcesso !== undefined) patch.numero_processo = input.numeroProcesso?.trim() || null
    if (input.dataProtocolo !== undefined) patch.data_protocolo = input.dataProtocolo
    if (input.valorCausa !== undefined) patch.valor_causa = input.valorCausa
    if (input.varaComarca !== undefined) patch.vara_comarca = input.varaComarca?.trim() || null
  }
  if (input.status === 'encerrado') {
    if (input.desfecho !== undefined) patch.desfecho = input.desfecho
    if (input.valorRecuperado !== undefined) patch.valor_recuperado = input.valorRecuperado
  }

  const { error } = await supabase.from('casos').update(patch).eq('id', casoId)
  if (error) throw error

  await supabase.from('andamentos').insert({
    id: `and-${crypto.randomUUID()}`,
    caso_id: casoId,
    tipo: 'status',
    titulo: `Status alterado para ${STATUS_CASO_ROTULO[input.status]}`,
    descricao: input.observacao?.trim() || null,
    data: input.dataMudanca,
    autor_id: userId,
    automatico: true,
  })

  const detalhe = await obterCaso(casoId)

  if (input.status === 'ajuizado' || input.status === 'encerrado') {
    const statusRotulo = STATUS_CASO_ROTULO[input.status]
    const texto =
      input.status === 'ajuizado'
        ? `Caso ajuizado: ${detalhe.cliente.nome} · ${detalhe.empreendimento}. Processo ${detalhe.numeroProcesso}.`
        : `Caso encerrado: ${detalhe.cliente.nome} · ${detalhe.empreendimento}. Desfecho: ${
            detalhe.desfecho ? DESFECHO_ROTULO[detalhe.desfecho] : statusRotulo
          }.`
    await publicarPost({
      texto,
      mencoes: [],
      casoVinculado: {
        id: detalhe.id,
        cliente: detalhe.cliente.nome,
        empreendimento: detalhe.empreendimento,
        status: statusRotulo,
        excesso: detalhe.excessoApurado,
      },
      anexo: null,
      restritoASocios: false,
      tipo: 'atualizacao',
    })
  }

  return detalhe
}

export async function concluirPrazo(prazoId: string): Promise<Prazo> {
  const userId = await getSessionUserId()
  const { data: prazo, error: findError } = await supabase
    .from('prazos')
    .select('*')
    .eq('id', prazoId)
    .single()
  if (findError) throw findError

  const concluidoEm = new Date().toISOString()
  const { data, error } = await supabase
    .from('prazos')
    .update({ concluido: true, concluido_em: concluidoEm })
    .eq('id', prazoId)
    .select('*')
    .single()
  if (error) throw error

  await supabase.from('andamentos').insert({
    id: `and-${crypto.randomUUID()}`,
    caso_id: prazo.caso_id,
    tipo: 'prazo',
    titulo: `Prazo cumprido: ${prazo.titulo}`,
    descricao: prazo.descricao,
    data: new Date().toISOString().slice(0, 10),
    autor_id: userId,
    automatico: true,
  })

  await supabase
    .from('casos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', prazo.caso_id)

  return mapPrazo(data as PrazoRow)
}

export async function anexarDocumento(
  casoId: string,
  chave: DocumentoChave,
  arquivo: File,
): Promise<DocumentoCaso> {
  const padrao = DOCUMENTOS_PADRAO.find((doc) => doc.chave === chave)
  if (!padrao) throw new Error('Documento inválido')

  const anexo = await uploadAnexoCaso(casoId, arquivo)
  const { data, error } = await supabase
    .from('documentos_caso')
    .upsert(
      {
        id: `doc-${casoId}-${chave}`,
        caso_id: casoId,
        chave,
        rotulo: padrao.rotulo,
        obrigatorio: padrao.obrigatorio,
        arquivo_id: anexo.id,
        arquivo_nome: anexo.nome,
        arquivo_tamanho_bytes: anexo.tamanhoBytes,
        arquivo_url: anexo.url,
      },
      { onConflict: 'caso_id,chave' },
    )
    .select('*')
    .single()
  if (error) throw error

  await supabase
    .from('casos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', casoId)

  return mapDocumento(data as DocRow)
}

export async function anexarDocumentoLivre(casoId: string, arquivo: File): Promise<DocumentoCaso> {
  const anexo = await uploadAnexoCaso(casoId, arquivo)
  const chave = `anexo-${crypto.randomUUID()}`
  const { data, error } = await supabase
    .from('documentos_caso')
    .insert({
      id: `doc-${crypto.randomUUID()}`,
      caso_id: casoId,
      chave,
      rotulo: arquivo.name,
      obrigatorio: false,
      arquivo_id: anexo.id,
      arquivo_nome: anexo.nome,
      arquivo_tamanho_bytes: anexo.tamanhoBytes,
      arquivo_url: anexo.url,
    })
    .select('*')
    .single()
  if (error) throw error

  await supabase
    .from('casos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', casoId)

  return mapDocumento(data as DocRow)
}

function caminhosStorageDocumento(row: DocRow, casoId: string): string[] {
  const caminhos = new Set<string>()
  if (row.arquivo_url) {
    const marcador = '/object/public/casos-arquivos/'
    const indice = row.arquivo_url.indexOf(marcador)
    if (indice >= 0) {
      const bruto = row.arquivo_url.slice(indice + marcador.length).split('?')[0]
      try {
        caminhos.add(decodeURIComponent(bruto))
      } catch {
        caminhos.add(bruto)
      }
    }
  }
  if (row.arquivo_id && row.arquivo_nome) {
    caminhos.add(`${casoId}/${row.arquivo_id}-${row.arquivo_nome}`)
  }
  return [...caminhos]
}

export async function excluirDocumento(casoId: string, chave: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('documentos_caso')
    .select('*')
    .eq('caso_id', casoId)
    .eq('chave', chave)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!data) throw new Error('Documento não encontrado')

  const row = data as DocRow
  const caminhos = caminhosStorageDocumento(row, casoId)
  const temArquivo = Boolean(row.arquivo_id || row.arquivo_url)

  if (isDocumentoPadrao(chave) && temArquivo) {
    const { error } = await supabase
      .from('documentos_caso')
      .update({
        arquivo_id: null,
        arquivo_nome: null,
        arquivo_tamanho_bytes: null,
        arquivo_url: null,
      })
      .eq('caso_id', casoId)
      .eq('chave', chave)
    if (error) throw error
  } else {
    const { error } = await supabase.from('documentos_caso').delete().eq('caso_id', casoId).eq('chave', chave)
    if (error) throw error
  }

  if (caminhos.length > 0) {
    await supabase.storage.from('casos-arquivos').remove(caminhos)
  }

  await supabase
    .from('casos')
    .update({ atualizado_em: new Date().toISOString() })
    .eq('id', casoId)
}
