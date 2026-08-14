import { publicarPost } from './mural'

export type CasoStatus = 'processo_de_venda' | 'ajuizado' | 'encerrado'

export interface Caso {
  id: string
  cliente: string
  empreendimento: string
  incorporadora: string
  valorContrato: number
  excessoApurado: number | null
  valorCausa: number | null
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
  /** R$ 2.500 por caso que já saiu de processo de venda (ajuizado ou encerrado). */
  proLaboreRecebido: number
  /** 30% do valor total de causa da base. */
  honorariosExitoEsperados: number
}

export const PRO_LABORE_POR_AJUIZAMENTO = 2_500
export const HONORARIOS_EXITO_PERCENTUAL = 0.3

export function calcularResumoCarteira(casos: Caso[]): CarteiraResumo {
  let emAndamento = 0
  let valorTotalCausa = 0
  let excessoTotalCarteira = 0
  let recuperado = 0

  for (const caso of casos) {
    if (caso.status === 'ajuizado' || caso.status === 'processo_de_venda') {
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
    casosCadastrados: casos.length,
    emAndamento,
    valorTotalCausa,
    excessoTotalCarteira,
    recuperado,
  }
}

export function calcularResumoFinanceiro(casos: Caso[]): CarteiraFinanceiro {
  let clientesComProLabore = 0
  let valorTotalCausa = 0

  for (const caso of casos) {
    if (caso.status === 'ajuizado' || caso.status === 'encerrado') {
      clientesComProLabore += 1
    }
    if (caso.valorCausa != null) {
      valorTotalCausa += caso.valorCausa
    }
  }

  return {
    proLaboreRecebido: clientesComProLabore * PRO_LABORE_POR_AJUIZAMENTO,
    honorariosExitoEsperados: valorTotalCausa * HONORARIOS_EXITO_PERCENTUAL,
  }
}

const RESPONSAVEIS = {
  VP: { nome: 'Vitor Paludetto', iniciais: 'VP' },
  RM: { nome: 'Renata Martins', iniciais: 'RM' },
  LF: { nome: 'Lucas Ferreira', iniciais: 'LF' },
} as const

const CASOS: Caso[] = [
  {
    id: 'caso-001',
    cliente: 'Marcos Almeida',
    empreendimento: 'Henry Boulevard',
    incorporadora: 'Kallas',
    valorContrato: 780_000,
    excessoApurado: 23_410,
    valorCausa: null,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: '2026-08-10T09:00:00-03:00',
  },
  {
    id: 'caso-002',
    cliente: 'Erika Tanaka',
    empreendimento: 'Vila Nova 1200',
    incorporadora: 'Cyrela',
    valorContrato: 1_150_000,
    excessoApurado: 34_820,
    valorCausa: 69_640,
    anoAjuizamento: 2023,
    status: 'ajuizado',
    responsavel: RESPONSAVEIS.RM,
    atualizadoEm: '2026-08-11T11:20:00-03:00',
  },
  {
    id: 'caso-003',
    cliente: 'Paula Ribeiro',
    empreendimento: 'Parque Cidade',
    incorporadora: 'MRV',
    valorContrato: 520_000,
    excessoApurado: null,
    valorCausa: null,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: '2026-08-09T15:40:00-03:00',
  },
  {
    id: 'caso-004',
    cliente: 'Luís Moreira',
    empreendimento: 'Alto da Lapa',
    incorporadora: 'Even',
    valorContrato: 640_000,
    excessoApurado: 19_070,
    valorCausa: null,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.LF,
    atualizadoEm: '2026-08-12T08:30:00-03:00',
  },
  {
    id: 'caso-005',
    cliente: 'Helena Costa',
    empreendimento: 'Reserva Ipê',
    incorporadora: 'Kallas',
    valorContrato: 890_000,
    excessoApurado: 27_150,
    valorCausa: 54_300,
    anoAjuizamento: 2022,
    status: 'ajuizado',
    responsavel: RESPONSAVEIS.RM,
    atualizadoEm: '2026-08-13T14:10:00-03:00',
  },
  {
    id: 'caso-006',
    cliente: 'Sérgio Nakamura',
    empreendimento: 'Jardins 900',
    incorporadora: 'Tegra',
    valorContrato: 1_420_000,
    excessoApurado: 42_600,
    valorCausa: 85_200,
    anoAjuizamento: 2022,
    status: 'encerrado',
    responsavel: RESPONSAVEIS.LF,
    atualizadoEm: '2026-08-08T17:00:00-03:00',
  },
  {
    id: 'caso-007',
    cliente: 'Camila Barros',
    empreendimento: 'Vista Sul',
    incorporadora: 'MRV',
    valorContrato: 470_000,
    excessoApurado: 14_280,
    valorCausa: 28_560,
    anoAjuizamento: 2023,
    status: 'ajuizado',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: '2026-08-14T10:05:00-03:00',
  },
]

export async function listarCasos(): Promise<Caso[]> {
  return CASOS.map((caso) => ({ ...caso, responsavel: { ...caso.responsavel } })) // TODO: conectar ao backend
}

export async function obterResumoCarteira(): Promise<CarteiraResumo> {
  return calcularResumoCarteira(CASOS) // TODO: conectar ao backend
}

export type NovoCasoInput = {
  cliente: string
  empreendimento?: string
  incorporadora?: string
  valorContrato: number
  excessoApurado: number | null
  valorCausa: number | null
}

export async function cadastrarCaso(input: NovoCasoInput): Promise<Caso> {
  const cliente = input.cliente.trim()
  if (!cliente) {
    throw new Error('Informe o nome do cliente')
  }

  const caso: Caso = {
    id: `caso-${Date.now()}`,
    cliente,
    empreendimento: input.empreendimento?.trim() || 'A definir',
    incorporadora: input.incorporadora?.trim() || 'A definir',
    valorContrato: input.valorContrato,
    excessoApurado: input.excessoApurado,
    valorCausa: input.valorCausa,
    anoAjuizamento: null,
    status: 'processo_de_venda',
    responsavel: RESPONSAVEIS.VP,
    atualizadoEm: new Date().toISOString(),
  }

  CASOS.unshift(caso)

  return { ...caso, responsavel: { ...caso.responsavel } } // TODO: conectar ao backend
}

export async function excluirCaso(id: string): Promise<void> {
  const indice = CASOS.findIndex((caso) => caso.id === id)
  if (indice === -1) {
    throw new Error('Caso não encontrado')
  }
  CASOS.splice(indice, 1)
  return // TODO: conectar ao backend
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

export type DocumentoChave = 'memorial' | 'contrato' | 'chaves' | 'comprovantes'

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
  chave: DocumentoChave
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

export const STATUS_CASO_ROTULO: Record<CasoStatus, string> = {
  processo_de_venda: 'Processo de venda',
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

const AUTOR_VITOR: AndamentoAutor = { id: 'usr-vitor', nome: 'Vitor P.', iniciais: 'VP' }
const AUTOR_RAFAELA: AndamentoAutor = { id: 'usr-rafaela', nome: 'Rafaela M.', iniciais: 'RM' }

const DOCUMENTOS_PADRAO: { chave: DocumentoChave; rotulo: string; obrigatorio: boolean }[] = [
  { chave: 'memorial', rotulo: 'Memorial de cálculo da incorporadora', obrigatorio: true },
  { chave: 'contrato', rotulo: 'Contrato de compra e venda', obrigatorio: false },
  { chave: 'chaves', rotulo: 'Termo de entrega de chaves', obrigatorio: false },
  { chave: 'comprovantes', rotulo: 'Comprovantes de pagamento', obrigatorio: false },
]

function arquivoMock(nome: string, tamanhoBytes: number): AndamentoAnexo {
  return {
    id: `arq-${nome}`,
    nome,
    tamanhoBytes,
    url: URL.createObjectURL(
      new Blob(['arquivo'], { type: 'application/pdf' }),
    ),
  }
}

function isoEm(diasAtras: number, hora = 12): string {
  const d = new Date()
  d.setDate(d.getDate() - diasAtras)
  d.setHours(hora, 0, 0, 0)
  return d.toISOString()
}

function clonarAndamento(item: Andamento): Andamento {
  return {
    ...item,
    autor: { ...item.autor },
    anexo: item.anexo ? { ...item.anexo } : null,
    acao: item.acao ? { ...item.acao } : null,
  }
}

function clonarCaso(caso: CasoDetalhe): CasoDetalhe {
  return {
    ...caso,
    cliente: { ...caso.cliente },
    parceiro: caso.parceiro ? { ...caso.parceiro } : null,
    responsavel: { ...caso.responsavel },
    enquadramento: {
      criteriosAtendidos: caso.enquadramento.criteriosAtendidos,
      criterios: caso.enquadramento.criterios.map((criterio) => ({ ...criterio })),
    },
    andamentos: caso.andamentos.map(clonarAndamento),
    prazos: caso.prazos.map((prazo) => ({ ...prazo })),
    documentos: caso.documentos.map((doc) => ({
      ...doc,
      arquivo: doc.arquivo ? { ...doc.arquivo } : null,
    })),
  }
}

function arquivoDeFile(arquivo: File): AndamentoAnexo {
  return {
    id: `arq-${crypto.randomUUID()}`,
    nome: arquivo.name,
    tamanhoBytes: arquivo.size,
    url: URL.createObjectURL(arquivo),
  }
}

function criteriosDe(caso: Caso): { rotulo: string; atendido: boolean }[] {
  return [
    { rotulo: 'Parcelas reais inferiores às do contrato', atendido: caso.excessoApurado != null },
    { rotulo: 'Obra entregue', atendido: caso.status !== 'processo_de_venda' || caso.excessoApurado != null },
    { rotulo: 'Dentro do prazo prescricional', atendido: true },
    { rotulo: 'Memorial de cálculo disponível', atendido: caso.excessoApurado != null },
    { rotulo: 'Excesso apurado', atendido: caso.excessoApurado != null },
  ]
}

function responsavelDeLista(responsavel: Caso['responsavel']): CasoDetalhe['responsavel'] {
  if (responsavel.iniciais === 'VP') return { id: 'usr-vitor', nome: 'Vitor P.', iniciais: 'VP' }
  if (responsavel.iniciais === 'RM') {
    return { id: 'usr-rafaela', nome: responsavel.nome, iniciais: 'RM' }
  }
  return { id: 'usr-lucas', nome: responsavel.nome, iniciais: responsavel.iniciais }
}

function sintetizarDeLista(caso: Caso): CasoDetalhe {
  const criterios = criteriosDe(caso)
  return {
    id: caso.id,
    cliente: { nome: caso.cliente, email: null, telefone: null },
    empreendimento: caso.empreendimento,
    incorporadora: caso.incorporadora,
    dataAssinatura: caso.atualizadoEm.slice(0, 10),
    valorContrato: caso.valorContrato,
    parcelasReais: 0,
    parcelasContrato: 0,
    parcelaResidual: null,
    situacaoObra: 'em_andamento',
    dataChaves: null,
    excessoApurado: caso.excessoApurado,
    valorCausa: caso.valorCausa,
    prescricaoEm: null,
    status: caso.status,
    numeroProcesso: null,
    dataProtocolo: caso.anoAjuizamento != null ? `${caso.anoAjuizamento}-01-01` : null,
    varaComarca: null,
    desfecho: null,
    valorRecuperado: null,
    parceiro: null,
    canalOrigem: 'Direto',
    responsavel: responsavelDeLista(caso.responsavel),
    enquadramento: {
      criteriosAtendidos: criterios.filter((item) => item.atendido).length,
      criterios,
    },
    andamentos: [],
    prazos: [],
    documentos: DOCUMENTOS_PADRAO.map((item) => ({ ...item, arquivo: null })),
  }
}

function casoExemplo(): CasoDetalhe {
  const criterios = [
    { rotulo: 'Parcelas reais inferiores às do contrato', atendido: true },
    { rotulo: 'Obra entregue', atendido: true },
    { rotulo: 'Dentro do prazo prescricional', atendido: true },
    { rotulo: 'Memorial de cálculo disponível', atendido: true },
    { rotulo: 'Excesso apurado', atendido: true },
  ]
  return {
    id: 'caso-001',
    cliente: {
      nome: 'Marcos Almeida',
      email: 'marcos@email.com',
      telefone: '(11) 98812-4400',
    },
    empreendimento: 'Henry Boulevard',
    incorporadora: 'Kallas',
    dataAssinatura: '2021-03-10',
    valorContrato: 780_000,
    parcelasReais: 28,
    parcelasContrato: 37,
    parcelaResidual: 100,
    situacaoObra: 'entregue',
    dataChaves: '2024-08-22',
    excessoApurado: 23_410,
    valorCausa: null,
    prescricaoEm: '2027-08-22',
    status: 'processo_de_venda',
    numeroProcesso: null,
    dataProtocolo: null,
    varaComarca: null,
    desfecho: null,
    valorRecuperado: null,
    parceiro: { id: 'par-001', nome: 'Imobiliária Vega', iniciais: 'IV' },
    canalOrigem: 'Indicação',
    responsavel: AUTOR_VITOR,
    enquadramento: { criteriosAtendidos: 5, criterios },
    andamentos: [
      {
        id: 'and-001',
        tipo: 'documento',
        titulo: 'Memorial de cálculo recebido',
        descricao: 'Cliente enviou o memorial pelo portal da Kallas. Apuração já rodada na calculadora.',
        data: '2026-08-14',
        autor: AUTOR_VITOR,
        anexo: arquivoMock('memorial-kallas.pdf', Math.round(1.2 * 1024 * 1024)),
        acao: null,
        automatico: false,
        criadoEm: isoEm(0, 10),
      },
      {
        id: 'and-002',
        tipo: 'calculo',
        titulo: 'Apuração concluída',
        descricao: 'Excesso de R$ 23.410 em 18 pagamentos. Relatório gerado.',
        data: '2026-08-14',
        autor: AUTOR_VITOR,
        anexo: null,
        acao: { rotulo: 'Abrir relatório', destino: '/calculadora' },
        automatico: false,
        criadoEm: isoEm(0, 9),
      },
      {
        id: 'and-003',
        tipo: 'contato',
        titulo: 'Reunião de apresentação',
        descricao: 'Cliente entendeu a tese e concordou em seguir. Pediu prazo para conversar com a esposa.',
        data: '2026-08-11',
        autor: AUTOR_RAFAELA,
        anexo: null,
        acao: null,
        automatico: false,
        criadoEm: isoEm(3, 16),
      },
      {
        id: 'and-004',
        tipo: 'sistema',
        titulo: 'Caso cadastrado',
        descricao: 'Indicação da Imobiliária Vega.',
        data: '2026-08-09',
        autor: AUTOR_RAFAELA,
        anexo: null,
        acao: null,
        automatico: true,
        criadoEm: isoEm(5, 11),
      },
    ],
    prazos: [
      {
        id: 'prz-001',
        titulo: 'Comprovantes de pagamento',
        descricao: 'Reunir comprovantes de pagamento faltantes antes do protocolo.',
        venceEm: '2026-08-28',
        concluido: false,
        concluidoEm: null,
      },
    ],
    documentos: [
      {
        chave: 'memorial',
        rotulo: 'Memorial de cálculo da incorporadora',
        obrigatorio: true,
        arquivo: arquivoMock('memorial-kallas.pdf', Math.round(1.2 * 1024 * 1024)),
      },
      {
        chave: 'contrato',
        rotulo: 'Contrato de compra e venda',
        obrigatorio: false,
        arquivo: arquivoMock('contrato-compra-venda.pdf', Math.round(3.4 * 1024 * 1024)),
      },
      {
        chave: 'chaves',
        rotulo: 'Termo de entrega de chaves',
        obrigatorio: false,
        arquivo: arquivoMock('termo-chaves.pdf', 420 * 1024),
      },
      {
        chave: 'comprovantes',
        rotulo: 'Comprovantes de pagamento',
        obrigatorio: false,
        arquivo: null,
      },
    ],
  }
}

const detalhes: Record<string, CasoDetalhe> = {
  'caso-001': casoExemplo(),
}

function garantirDetalhe(id: string): CasoDetalhe | null {
  const existente = detalhes[id]
  if (existente) return existente
  const caso = CASOS.find((item) => item.id === id)
  if (!caso) return null
  const criado = sintetizarDeLista(caso)
  detalhes[id] = criado
  return criado
}

function sincronizarLista(detalhe: CasoDetalhe) {
  const item = CASOS.find((caso) => caso.id === detalhe.id)
  if (!item) return
  item.status = detalhe.status
  item.valorCausa = detalhe.valorCausa
  item.excessoApurado = detalhe.excessoApurado
  item.atualizadoEm = new Date().toISOString()
  if (detalhe.dataProtocolo) {
    item.anoAjuizamento = Number(detalhe.dataProtocolo.slice(0, 4))
  }
}

function autorAtual(): AndamentoAutor {
  return { ...AUTOR_VITOR }
}

function novoAndamento(partial: Omit<Andamento, 'id' | 'criadoEm' | 'autor'> & { autor?: AndamentoAutor }): Andamento {
  return {
    id: `and-${crypto.randomUUID()}`,
    criadoEm: new Date().toISOString(),
    autor: partial.autor ?? autorAtual(),
    ...partial,
  }
}

export async function obterCaso(id: string): Promise<CasoDetalhe> {
  const detalhe = garantirDetalhe(id)
  if (!detalhe) throw new Error('Caso não encontrado')
  return clonarCaso(detalhe) // TODO: conectar ao backend
}

export async function registrarAndamento(
  casoId: string,
  input: RegistrarAndamentoInput,
): Promise<Andamento> {
  const detalhe = garantirDetalhe(casoId)
  if (!detalhe) throw new Error('Caso não encontrado')
  const andamento = novoAndamento({
    tipo: input.tipo,
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || null,
    data: input.data,
    anexo: input.anexo ? arquivoDeFile(input.anexo) : null,
    acao: null,
    automatico: false,
  })
  detalhe.andamentos.unshift(andamento)
  if (input.criarPrazo && input.dataPrazo) {
    detalhe.prazos.unshift({
      id: `prz-${crypto.randomUUID()}`,
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      venceEm: input.dataPrazo,
      concluido: false,
      concluidoEm: null,
    })
  }
  sincronizarLista(detalhe)
  return clonarAndamento(andamento) // TODO: conectar ao backend
}

export async function editarAndamento(
  andamentoId: string,
  input: EditarAndamentoInput,
): Promise<Andamento> {
  for (const detalhe of Object.values(detalhes)) {
    const andamento = detalhe.andamentos.find((item) => item.id === andamentoId)
    if (!andamento) continue
    andamento.tipo = input.tipo
    andamento.titulo = input.titulo.trim()
    andamento.descricao = input.descricao?.trim() || null
    andamento.data = input.data
    if (input.anexo) andamento.anexo = arquivoDeFile(input.anexo)
    sincronizarLista(detalhe)
    return clonarAndamento(andamento) // TODO: conectar ao backend
  }
  throw new Error('Andamento não encontrado')
}

export async function mudarStatus(casoId: string, input: MudarStatusInput): Promise<CasoDetalhe> {
  const detalhe = garantirDetalhe(casoId)
  if (!detalhe) throw new Error('Caso não encontrado')

  detalhe.status = input.status
  if (input.status === 'ajuizado') {
    detalhe.numeroProcesso = input.numeroProcesso?.trim() || detalhe.numeroProcesso
    detalhe.dataProtocolo = input.dataProtocolo || detalhe.dataProtocolo
    detalhe.valorCausa = input.valorCausa ?? detalhe.valorCausa
    detalhe.varaComarca = input.varaComarca?.trim() || detalhe.varaComarca
  }
  if (input.status === 'encerrado') {
    detalhe.desfecho = input.desfecho ?? detalhe.desfecho
    detalhe.valorRecuperado = input.valorRecuperado ?? detalhe.valorRecuperado
  }

  const observacao = input.observacao?.trim() || null
  const andamento = novoAndamento({
    tipo: 'status',
    titulo: `Status alterado para ${STATUS_CASO_ROTULO[input.status]}`,
    descricao: observacao,
    data: input.dataMudanca,
    anexo: null,
    acao: null,
    automatico: true,
  })
  detalhe.andamentos.unshift(andamento)
  sincronizarLista(detalhe)

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
    })
  }

  return clonarCaso(detalhe) // TODO: conectar ao backend
}

export async function concluirPrazo(prazoId: string): Promise<Prazo> {
  for (const detalhe of Object.values(detalhes)) {
    const prazo = detalhe.prazos.find((item) => item.id === prazoId)
    if (!prazo) continue
    prazo.concluido = true
    prazo.concluidoEm = new Date().toISOString()
    detalhe.andamentos.unshift(
      novoAndamento({
        tipo: 'prazo',
        titulo: `Prazo cumprido: ${prazo.titulo}`,
        descricao: prazo.descricao,
        data: new Date().toISOString().slice(0, 10),
        anexo: null,
        acao: null,
        automatico: true,
      }),
    )
    sincronizarLista(detalhe)
    return { ...prazo } // TODO: conectar ao backend
  }
  throw new Error('Prazo não encontrado')
}

export async function anexarDocumento(
  casoId: string,
  chave: DocumentoChave,
  arquivo: File,
): Promise<DocumentoCaso> {
  const detalhe = garantirDetalhe(casoId)
  if (!detalhe) throw new Error('Caso não encontrado')
  const doc = detalhe.documentos.find((item) => item.chave === chave)
  if (!doc) throw new Error('Documento não encontrado')
  doc.arquivo = arquivoDeFile(arquivo)
  sincronizarLista(detalhe)
  return { ...doc, arquivo: doc.arquivo ? { ...doc.arquivo } : null } // TODO: conectar ao backend
}
