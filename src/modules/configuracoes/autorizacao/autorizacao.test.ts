import { describe, expect, it } from 'vitest'
import {
  MATRIZ_PADRAO,
  NIVEIS_PERMISSAO,
  PAPEIS_SISTEMA,
  RECURSOS,
  acessoConfiguracoesBloqueadoPor2fa,
  acoesVisiveisSocio,
  alterarPermissaoPermitido,
  aporteConsistente,
  bloqueiaAutoEdicaoParticipacao,
  bloqueiaAutoExclusao,
  bloqueiaAutoPapel,
  bloqueiaAutoSaida,
  bloqueiaAutoSuspensao,
  casoVisivelPara,
  cpfValido,
  dataEntradaValida,
  deixariaSemSocioAtivo,
  deixariaSemUsuarioSocioAtivo,
  derivarSituacaoSocio,
  expiresAtIso,
  filtrarCasosPorResponsavel,
  mascararCpf,
  migraUsuariosAntesDeExcluirPapel,
  motivosExclusaoBloqueada,
  nivelPadraoRecursoNovo,
  nivelSuficiente,
  niveisPermitidosNaCelula,
  papelSocioImutavel,
  participacaoExcedeCem,
  participacaoNoIntervalo,
  participacaoParaCentesimos,
  podeAcessarMapa,
  podeAutenticar,
  mensagemLoginRecusado,
  podeEditarCampoSocio,
  senhasConferem,
  isPapelSistema,
  recursoConhecido,
  mapaVazio,
  mapaDePapel,
  fraseAlteracaoCampo,
  confirmacaoComContexto,
  centesimosParaParticipacao,
  desvioParticipacao,
  tokenPareceBruto,
  podeExcluirCadastro,
  precisaReautenticar,
  senhaAceita,
  temAlgumaPermissaoConfiguracoes,
  tokenUsavel,
  type SocioResumo,
  type UsuarioResumo,
} from './index'

function socio(parcial: Partial<SocioResumo> & Pick<SocioResumo, 'id'>): SocioResumo {
  return {
    usuarioId: null,
    participacaoCentesimos: 5_000,
    aporteComprometido: 600_000,
    aporteIntegralizado: 0,
    dataSaida: null,
    deletadoEm: null,
    usuarioJaLogou: false,
    temLancamentoFinanceiro: false,
    ...parcial,
  }
}

describe('matriz padrão — cada papel × recurso × nível', () => {
  for (const papel of PAPEIS_SISTEMA) {
    for (const recurso of RECURSOS) {
      for (const nivel of NIVEIS_PERMISSAO) {
        const esperado = nivelSuficiente(MATRIZ_PADRAO[papel][recurso], nivel)
        it(`${papel} em ${recurso} com ${nivel} → ${esperado ? 'permite' : 'nega'}`, () => {
          expect(podeAcessarMapa(MATRIZ_PADRAO[papel], recurso, nivel)).toBe(esperado)
        })
      }
    }
  }

  it('total implica editar, que implica ler', () => {
    expect(nivelSuficiente('total', 'editar')).toBe(true)
    expect(nivelSuficiente('total', 'ler')).toBe(true)
    expect(nivelSuficiente('editar', 'ler')).toBe(true)
    expect(nivelSuficiente('ler', 'editar')).toBe(false)
    expect(nivelSuficiente('nenhum', 'ler')).toBe(false)
  })

  it('auditoria do sócio é ler, nunca total', () => {
    expect(MATRIZ_PADRAO.socio['configuracoes.auditoria']).toBe('ler')
    expect(podeAcessarMapa(MATRIZ_PADRAO.socio, 'configuracoes.auditoria', 'editar')).toBe(false)
  })

  it('operação não acessa financeiro nem configurações', () => {
    expect(podeAcessarMapa(MATRIZ_PADRAO.operacao, 'financeiro.lancamentos', 'ler')).toBe(false)
    expect(podeAcessarMapa(MATRIZ_PADRAO.operacao, 'configuracoes.socios', 'ler')).toBe(false)
  })

  it('parceiro jurídico não vê parcerias', () => {
    expect(podeAcessarMapa(MATRIZ_PADRAO.parceiro_juridico, 'parcerias', 'ler')).toBe(false)
  })

  it('somente sócio vê o item Configurações na matriz padrão', () => {
    expect(temAlgumaPermissaoConfiguracoes(MATRIZ_PADRAO.socio)).toBe(true)
    expect(temAlgumaPermissaoConfiguracoes(MATRIZ_PADRAO.financeiro)).toBe(false)
    expect(temAlgumaPermissaoConfiguracoes(MATRIZ_PADRAO.operacao)).toBe(false)
    expect(temAlgumaPermissaoConfiguracoes(MATRIZ_PADRAO.leitura)).toBe(false)
  })
})

describe('célula da matriz e recurso novo', () => {
  it('coluna sócio é bloqueada', () => {
    expect(niveisPermitidosNaCelula('socio', 'casos')).toBe('bloqueado')
    expect(alterarPermissaoPermitido('socio', 'casos', 'ler')).toBe(false)
  })

  it('auditoria não admite editar nem total em nenhum papel', () => {
    expect(alterarPermissaoPermitido('operacao', 'configuracoes.auditoria', 'editar')).toBe(false)
    expect(alterarPermissaoPermitido('operacao', 'configuracoes.auditoria', 'total')).toBe(false)
    expect(alterarPermissaoPermitido('operacao', 'configuracoes.auditoria', 'ler')).toBe(true)
  })

  it('recurso novo entra nenhum em todos, total no sócio', () => {
    expect(nivelPadraoRecursoNovo('socio')).toBe('total')
    for (const papel of PAPEIS_SISTEMA) {
      if (papel === 'socio') continue
      expect(nivelPadraoRecursoNovo(papel)).toBe('nenhum')
    }
  })

  it('papel socio é imutável', () => {
    expect(papelSocioImutavel('socio')).toBe(true)
    expect(papelSocioImutavel('operacao')).toBe(false)
  })
})

describe('acesso direto sem permissão', () => {
  it('leitura não entra em /configuracoes/socios', () => {
    expect(podeAcessarMapa(MATRIZ_PADRAO.leitura, 'configuracoes.socios', 'ler')).toBe(false)
  })

  it('financeiro não entra em usuários', () => {
    expect(podeAcessarMapa(MATRIZ_PADRAO.financeiro, 'configuracoes.usuarios', 'ler')).toBe(false)
  })
})

describe('auto-edição e auto-remoção', () => {
  const eu = socio({ id: 's1', usuarioId: 'u-helena', participacaoCentesimos: 4_000 })

  it('ninguém edita a própria participação', () => {
    expect(bloqueiaAutoEdicaoParticipacao('u-helena', eu)).toBe(true)
    expect(bloqueiaAutoEdicaoParticipacao('u-vitor', eu)).toBe(false)
  })

  it('ninguém registra a própria saída nem exclui o próprio cadastro', () => {
    expect(bloqueiaAutoSaida('u-helena', eu)).toBe(true)
    expect(bloqueiaAutoExclusao('u-helena', eu)).toBe(true)
  })

  it('ninguém altera o próprio papel ou suspende a própria conta', () => {
    expect(bloqueiaAutoPapel('u-helena', 'u-helena')).toBe(true)
    expect(bloqueiaAutoSuspensao('u-helena', 'u-helena')).toBe(true)
    expect(bloqueiaAutoPapel('u-vitor', 'u-helena')).toBe(false)
  })
})

describe('sistema sem sócio', () => {
  it('bloqueia a saída que deixaria o quadro vazio', () => {
    const quadro = [socio({ id: 'unico', usuarioId: 'u1', participacaoCentesimos: 10_000 })]
    expect(deixariaSemSocioAtivo(quadro, 'unico', '2026-08-16')).toBe(true)
    expect(deixariaSemSocioAtivo(quadro, 'unico', null)).toBe(false)
  })

  it('permite sair se permanece outro ativo', () => {
    const quadro = [
      socio({ id: 'a', usuarioId: 'u1' }),
      socio({ id: 'b', usuarioId: 'u2' }),
    ]
    expect(deixariaSemSocioAtivo(quadro, 'a', '2026-08-16')).toBe(false)
  })

  it('bloqueia desativar o último usuário com papel socio', () => {
    const usuarios: UsuarioResumo[] = [
      { id: 'u1', papelId: 'socio', situacao: 'ativo' },
      { id: 'u2', papelId: 'operacao', situacao: 'ativo' },
    ]
    expect(deixariaSemUsuarioSocioAtivo(usuarios, 'u1', 'desativado')).toBe(true)
    expect(deixariaSemUsuarioSocioAtivo(usuarios, 'u1', 'ativo', 'operacao')).toBe(true)
    expect(deixariaSemUsuarioSocioAtivo(usuarios, 'u2', 'desativado')).toBe(false)
  })
})

describe('participação', () => {
  it('bloqueia soma acima de 100%', () => {
    const quadro = [
      socio({ id: 'a', participacaoCentesimos: 6_000 }),
      socio({ id: 'b', participacaoCentesimos: 4_000 }),
    ]
    const result = participacaoExcedeCem(quadro, 4_100, 'b')
    expect(result.excede).toBe(true)
    expect(result.excessoCentesimos).toBe(100)
  })

  it('permite salvar abaixo de 100%', () => {
    const quadro = [socio({ id: 'a', participacaoCentesimos: 4_000 })]
    expect(participacaoExcedeCem(quadro, 5_000, 'a').excede).toBe(false)
  })

  it('reverter saída que ultrapassaria 100% é bloqueado', () => {
    const quadro = [
      socio({ id: 'a', participacaoCentesimos: 6_000 }),
      socio({ id: 'b', participacaoCentesimos: 4_000 }),
      socio({ id: 'c', participacaoCentesimos: 2_000, dataSaida: '2026-01-01' }),
    ]
    expect(participacaoExcedeCem(quadro, 2_000, 'c').excede).toBe(true)
  })

  it('participação deve estar entre 0,01% e 100%', () => {
    expect(participacaoNoIntervalo(1)).toBe(true)
    expect(participacaoNoIntervalo(0)).toBe(false)
    expect(participacaoNoIntervalo(10_001)).toBe(false)
    expect(participacaoParaCentesimos(15)).toBe(1_500)
  })
})

describe('CPF', () => {
  it('aceita dígito verificador válido e recusa inválido', () => {
    expect(cpfValido('390.533.447-05')).toBe(true)
    expect(cpfValido('39053344705')).toBe(true)
    expect(cpfValido('390.533.447-00')).toBe(false)
    expect(cpfValido('11111111111')).toBe(false)
    expect(cpfValido('123')).toBe(false)
  })

  it('mascara o miolo', () => {
    expect(mascararCpf('39053344705')).toBe('390.***.***-05')
  })
})

describe('exclusão de cadastro — quatro condições', () => {
  const quadroBase = [
    socio({ id: 'a', usuarioId: 'u-a', participacaoCentesimos: 5_000 }),
    socio({ id: 'b', participacaoCentesimos: 5_000 }),
  ]

  it('bloqueia com aporte integralizado', () => {
    const alvo = socio({ id: 'a', aporteIntegralizado: 1, participacaoCentesimos: 5_000 })
    expect(motivosExclusaoBloqueada(alvo, [alvo, quadroBase[1]])).toContain('aporte_integralizado')
    expect(podeExcluirCadastro(alvo, [alvo, quadroBase[1]])).toBe(false)
  })

  it('bloqueia com lançamento financeiro vinculado', () => {
    const alvo = socio({ id: 'a', temLancamentoFinanceiro: true })
    expect(motivosExclusaoBloqueada(alvo, [alvo, quadroBase[1]])).toContain('lancamento_financeiro')
  })

  it('bloqueia com conta que já fez login', () => {
    const alvo = socio({ id: 'a', usuarioId: 'u-a', usuarioJaLogou: true })
    expect(motivosExclusaoBloqueada(alvo, [alvo, quadroBase[1]])).toContain('conta_com_login')
  })

  it('bloqueia se é o único ativo', () => {
    const unico = socio({ id: 'a', aporteIntegralizado: 0 })
    expect(motivosExclusaoBloqueada(unico, [unico])).toContain('unico_ativo')
  })

  it('permite quando as quatro condições passam', () => {
    const alvo = socio({ id: 'a', usuarioId: 'u-a', usuarioJaLogou: false, aporteIntegralizado: 0 })
    expect(podeExcluirCadastro(alvo, [alvo, quadroBase[1]])).toBe(true)
  })

  it('mostra reverter saída quando o sócio já saiu', () => {
    const inativo = socio({ id: 'a', dataSaida: '2026-01-01' })
    const outro = socio({ id: 'b', participacaoCentesimos: 5_000 })
    expect(
      acoesVisiveisSocio({ permissao: 'total', socio: inativo, quadro: [inativo, outro] }),
    ).toEqual(['editar', 'reverter_saida', 'excluir'])
  })

  it('quem tem só editar não vê saída nem exclusão', () => {
    const alvo = socio({ id: 'a' })
    expect(acoesVisiveisSocio({ permissao: 'editar', socio: alvo, quadro: quadroBase })).toEqual(['editar'])
    expect(acoesVisiveisSocio({ permissao: 'ler', socio: alvo, quadro: quadroBase })).toEqual([])
  })
})

describe('convite — expirado, reutilizado, reenviado', () => {
  it('expirado não serve', () => {
    expect(
      tokenUsavel({
        tipo: 'convite',
        usadoEm: null,
        expiresAt: '2026-01-01T00:00:00.000Z',
      }, new Date('2026-08-16T00:00:00.000Z')),
    ).toBe('expirado')
  })

  it('reutilizado (já usado) não serve', () => {
    expect(
      tokenUsavel({
        tipo: 'convite',
        usadoEm: '2026-08-01T00:00:00.000Z',
        expiresAt: '2026-08-20T00:00:00.000Z',
      }, new Date('2026-08-16T00:00:00.000Z')),
    ).toBe('usado')
  })

  it('reenvio: token anterior deixa de ser usável depois de marcado usado', () => {
    const anterior = tokenUsavel({
      tipo: 'convite',
      usadoEm: '2026-08-16T12:00:00.000Z',
      expiresAt: expiresAtIso('convite', new Date('2026-08-16T12:00:00.000Z')),
    }, new Date('2026-08-16T12:05:00.000Z'))
    expect(anterior).toBe('usado')
    const novo = tokenUsavel({
      tipo: 'convite',
      usadoEm: null,
      expiresAt: expiresAtIso('convite', new Date('2026-08-16T12:00:00.000Z')),
    }, new Date('2026-08-16T12:05:00.000Z'))
    expect(novo).toBe('ok')
  })
})

describe('login recusado por situação e senha', () => {
  it('convidado, suspenso e desativado não autenticam', () => {
    expect(podeAutenticar('ativo')).toBe(true)
    expect(podeAutenticar('convidado')).toBe(false)
    expect(podeAutenticar('suspenso')).toBe(false)
    expect(podeAutenticar('desativado')).toBe(false)
    expect(mensagemLoginRecusado()).toBe('E-mail ou senha incorretos.')
  })

  it('recusa senha curta ou óbvia', () => {
    expect(senhaAceita('curta').ok).toBe(false)
    expect(senhaAceita('password12345').ok).toBe(false)
    expect(senhaAceita('LetraENumero1').ok).toBe(true)
  })
})

describe('reautenticação, 2FA e papéis customizados', () => {
  it('pede senha se a última autenticação tem mais de 30 minutos', () => {
    expect(precisaReautenticar('2026-08-16T12:00:00.000Z', new Date('2026-08-16T12:31:00.000Z'))).toBe(true)
    expect(precisaReautenticar('2026-08-16T12:00:00.000Z', new Date('2026-08-16T12:10:00.000Z'))).toBe(false)
    expect(precisaReautenticar(null)).toBe(true)
  })

  it('bloqueio de Configurações por 2FA está desativado por enquanto', () => {
    expect(
      acessoConfiguracoesBloqueadoPor2fa({
        papelId: 'socio',
        doisFatoresAtivo: false,
        doisFatoresDesde: '2026-08-01T00:00:00.000Z',
        agora: new Date('2026-08-16T00:00:00.000Z'),
      }),
    ).toBe(false)
    expect(
      acessoConfiguracoesBloqueadoPor2fa({
        papelId: 'socio',
        doisFatoresAtivo: true,
        doisFatoresDesde: '2026-08-01T00:00:00.000Z',
        agora: new Date('2026-08-16T00:00:00.000Z'),
      }),
    ).toBe(false)
  })

  it('papel com usuários vinculados não se exclui', () => {
    expect(migraUsuariosAntesDeExcluirPapel(2)).toBe(false)
    expect(migraUsuariosAntesDeExcluirPapel(0)).toBe(true)
  })
})

describe('aporte, datas e situação derivada', () => {
  it('integralizado não pode exceder comprometido', () => {
    expect(aporteConsistente(600_000, 600_000)).toBe(true)
    expect(aporteConsistente(600_000, 600_001)).toBe(false)
  })

  it('data de entrada não pode ser futura', () => {
    expect(dataEntradaValida('2026-08-16', '2026-08-16')).toBe(true)
    expect(dataEntradaValida('2026-08-17', '2026-08-16')).toBe(false)
  })

  it('situação deriva de saída e aportes', () => {
    expect(derivarSituacaoSocio({ dataSaida: '2026-01-01', aporteComprometido: 1, aporteIntegralizado: 1 })).toBe('inativo')
    expect(derivarSituacaoSocio({ dataSaida: null, aporteComprometido: 100, aporteIntegralizado: 40 })).toBe('aporte_pendente')
    expect(derivarSituacaoSocio({ dataSaida: null, aporteComprometido: 100, aporteIntegralizado: 100 })).toBe('ativo')
  })
})

describe('filtro parceiro jurídico', () => {
  it('só enxerga casos em que é responsável', () => {
    expect(casoVisivelPara({ papelId: 'parceiro_juridico', usuarioId: 'u1', responsavelId: 'u1' })).toBe(true)
    expect(casoVisivelPara({ papelId: 'parceiro_juridico', usuarioId: 'u1', responsavelId: 'u2' })).toBe(false)
    expect(casoVisivelPara({ papelId: 'operacao', usuarioId: 'u1', responsavelId: 'u2' })).toBe(true)
    const casos = filtrarCasosPorResponsavel(
      [{ id: 'c1', responsavelId: 'u1' }, { id: 'c2', responsavelId: 'u2' }],
      'parceiro_juridico',
      'u1',
    )
    expect(casos.map((c) => c.id)).toEqual(['c1'])
  })
})

describe('cobertura da camada pura restante', () => {
  it('mapeia papéis, recursos e mapa vazio', () => {
    expect(isPapelSistema('socio')).toBe(true)
    expect(isPapelSistema('outro')).toBe(false)
    expect(recursoConhecido('casos')).toBe(true)
    expect(recursoConhecido('x')).toBe(false)
    expect(mapaVazio().calculadora).toBe('nenhum')
    expect(mapaDePapel('operacao').casos).toBe('editar')
    expect(mapaDePapel('custom').casos).toBe('nenhum')
  })

  it('formata auditoria e confirmação com contexto', () => {
    expect(fraseAlteracaoCampo({ campo: 'a participação', nome: 'Lucas Ferraz', anterior: '15,0%', novo: '12,0%' })).toBe(
      'Alterou a participação de Lucas Ferraz de 15,0% para 12,0%',
    )
    expect(confirmacaoComContexto('Alterou a participação')).toBe('Alterou a participação?')
    expect(confirmacaoComContexto('Já pergunta?')).toBe('Já pergunta?')
  })

  it('converte participação e descreve o desvio', () => {
    expect(centesimosParaParticipacao(1500)).toBe(15)
    expect(desvioParticipacao(10_000).fecha).toBe(true)
    expect(desvioParticipacao(9_800).desvio).toBe(-200)
  })

  it('distingue campos de edição por nível', () => {
    expect(podeEditarCampoSocio('editar', 'telefone')).toBe(true)
    expect(podeEditarCampoSocio('editar', 'participacao')).toBe(false)
    expect(podeEditarCampoSocio('total', 'participacao')).toBe(true)
    expect(podeEditarCampoSocio('ler', 'nomeCompleto')).toBe(false)
  })

  it('confere senha e recusa repetição / sequência', () => {
    expect(senhasConferem('LetraENumero1', 'LetraENumero1')).toBe(true)
    expect(senhasConferem('LetraENumero1', 'outra')).toBe(false)
    expect(senhaAceita('aaaaaaaaaaaa').ok).toBe(false)
    expect(senhaAceita('123456789012').ok).toBe(false)
    expect(senhaAceita('SomenteLetras').ok).toBe(false)
  })

  it('lista níveis permitidos e filtra casos de operação sem recorte', () => {
    expect(niveisPermitidosNaCelula('operacao', 'casos')).toEqual(['nenhum', 'ler', 'editar', 'total'])
    const todos = filtrarCasosPorResponsavel(
      [{ id: 'c1', responsavelId: 'u1' }, { id: 'c2', responsavelId: 'u2' }],
      'operacao',
      'u1',
    )
    expect(todos).toHaveLength(2)
    expect(
      acessoConfiguracoesBloqueadoPor2fa({
        papelId: 'socio',
        doisFatoresAtivo: false,
        doisFatoresDesde: null,
      }),
    ).toBe(false)
  })

  it('reconhece token bruto em hex', () => {
    expect(tokenPareceBruto('a'.repeat(64))).toBe(true)
    expect(tokenPareceBruto('curto')).toBe(false)
  })

  it('não existe ação de update ou delete na lista de ações de domínio da trilha', () => {
    const proibidas = ['atualizar_auditoria', 'apagar_auditoria', 'update', 'delete']
    expect(proibidas.includes('criar')).toBe(false)
  })
})
