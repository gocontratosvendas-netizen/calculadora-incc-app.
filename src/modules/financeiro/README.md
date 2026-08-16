# Módulo Financeiro

A DRE não é uma tela de entrada. A única fonte de verdade é o lançamento do fluxo de caixa. Cada classificação mapeia para uma linha da demonstração; o relatório é agregação. Se um número da DRE está errado, o lançamento é que precisa ser corrigido.

## Dinheiro

Valores são inteiros em **centavos** (`bigint` no Postgres, `number` inteiro na engine). Nunca some dinheiro em ponto flutuante. `Intl.NumberFormat('pt-BR')` arredonda uma única vez, na apresentação.

## Grupos da DRE

| Grupo | Papel |
|---|---|
| `receita_bruta` | Cessão, êxito, upside, outras receitas |
| `imposto_sobre_receita` | Impostos incidentes sobre a receita |
| `custo_direto` | Custa com o volume de casos — produz a margem bruta |
| `despesa_operacional` | Fixa, independe do volume |
| `depreciacao` | Depreciação e amortização |
| `resultado_financeiro` | Entradas menos saídas do grupo |
| `ir_csll` | IRPJ e CSLL |
| `null` | Aporte de sócios e empréstimo/funding — aparecem no caixa, **nunca** na DRE |

## Regime

- Competência: `dataEmissao` no intervalo.
- Caixa: `dataPagamento` preenchida **e** no intervalo. Não liquidado não existe. Vencimento não é proxy de pagamento.

## Como criar uma classificação nova

Insira em `fin_classificacoes` (ou use `fin_criar_classificacao`) com `codigo` único, `movimentacao`, `grupoDRE` e `ordem` no fim do grupo. Relatórios anteriores não quebram: a agregação é pelo grupo, não pela lista fixa de códigos. Contas com lançamento vinculado não se excluem — só se desativam (`ativa = false`).

Aporte e funding devem permanecer com `grupoDRE` nulo. Contabilizá-los como receita infla o resultado.

## Fronteiras (não cruzar)

- Todo o código vive em `src/modules/financeiro/`. O host só importa `index.ts`.
- Sem import da calculadora, de casos, mural ou parcerias. `casoId` é `string` solta, sem FK.
- Tabelas `fin_*`. Migrations independentes. Sem FK para tabelas de outros módulos.
- Acesso: sócio (via `profiles.papel`) ou linha em `fin_acessos`. RLS e RPCs no servidor. Menu oculto e 403 na URL direta.
- Error boundary própria: falha aqui não derruba a calculadora.

Contrato HTTP equivalente (hoje: RPCs):

- `POST /api/financeiro/lancamentos` → `fin_criar_lancamento`
- `PATCH /api/financeiro/lancamentos/:id` → `fin_editar_lancamento`
- `POST /api/financeiro/lancamentos/:id/liquidar` → `fin_liquidar_lancamento`
- `DELETE /api/financeiro/lancamentos/:id` → `fin_excluir_lancamento` (soft delete)

Para conceder o papel financeiro a alguém que não é sócio:

```sql
insert into public.fin_acessos (usuario_id, papel_fin) values ('<uuid>', 'financeiro');
```
