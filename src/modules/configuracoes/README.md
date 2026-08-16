# Configurações do VERUM

Autoridade de autorização do sistema. Código em `src/modules/configuracoes/`. Tabelas `cfg_*`. Os demais módulos importam a interface pública; este módulo não importa Casos, Financeiro, Parcerias nem a calculadora.

## Identidade

A sessão é o **Supabase Auth** (JWT). Não há segundo cadastro de senhas. Logout chama `cfg_logout` (invalida a sessão no servidor via `sessoes_revogadas_em`) e em seguida `signOut`. Situação diferente de `ativo` recusa o login com a mesma mensagem neutra.

## Instalação

1. `npm run db:start` e copie as chaves para `.env.local` (veja `.env.example`).
2. `npm run db:reset` aplica as migrations, inclusive `cfg_*` e o seed idempotente dos papéis.
3. Desenvolvimento com dados de demonstração: `npm run db:seed` (Helena e os demais já entram como usuários ativos).
4. Primeiro sócio em banco vazio, sem demo:

```bash
BOOTSTRAP_ONLY=1 BOOTSTRAP_ADMIN_EMAIL=voce@verum.adv.br BOOTSTRAP_ADMIN_NOME="Seu Nome" npm run db:seed
```

O link de definição de senha é impresso no console. Sem isso ninguém define senha. Rodar de novo com usuários existentes não cria nem sobrescreve.

5. E-mail: com `EMAIL_PROVIDER=console` os links (convite e redefinição) vão para o console do navegador (`despejarFilaEmails`) e da Edge Function. Em produção use `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM` e rode `supabase functions serve` (local) ou faça deploy de `cfg-auth`.

6. Convite/aceite de senha: `supabase functions serve cfg-auth`. A função tem `verify_jwt = false` porque o convidado ainda não está autenticado.

## Interface pública

```ts
import { podeAcessar, obterPermissoes, exigirPermissao, usuarioAtual } from '../configuracoes'

await podeAcessar(usuarioId, 'financeiro.dre', 'ler')
await exigirPermissao('configuracoes.socios', 'editar')(usuarioId)
const sessao = await usuarioAtual()
```

No servidor, o equivalente é `cfg_pode_acessar(recurso, nivel)` no começo de cada RPC. Esconder item de menu não é segurança.

Contrato HTTP equivalente (hoje: RPCs):

| HTTP | RPC |
|---|---|
| GET /api/configuracoes/sessao | `cfg_sessao_atual` |
| GET /api/configuracoes/socios | `cfg_listar_socios` |
| POST /api/configuracoes/socios | `cfg_criar_socio` |
| PATCH /api/configuracoes/socios/:id | `cfg_editar_socio` |
| POST .../saida | `cfg_registrar_saida` |
| DELETE /api/configuracoes/socios/:id | `cfg_excluir_socio` (soft, `deletado_em`) |
| GET /api/configuracoes/auditoria | `cfg_listar_auditoria` |

Não existem rotas de update ou delete da auditoria. Um trigger recusa `UPDATE`/`DELETE` em `cfg_auditoria`.

## Papéis e matriz

O papel `socio` é imutável. Auditoria admite no máximo `ler`. Recurso novo entra `nenhum` em todos os papéis, `total` no sócio (`cfg_garantir_recurso`). Sócios customizam os demais papéis; a coluna Sócio na matriz é somente leitura.

`parceiro_juridico` só enxerga casos em que é `responsavel_id` — `casoVisivelPara` / `cfg_pode_ver_caso`.

## Salvaguardas

Nunca zero sócios ativos, nem zero usuários ativos com papel `socio`. Ninguém altera a própria participação, registra a própria saída, exclui o próprio cadastro, muda o próprio papel ou suspende a própria conta. Excluir cadastro de sócio (erro de registro) é distinto de registrar saída. Reautenticação após 30 minutos nas ações societárias sensíveis e na alteração de permissão. Sócio sem 2FA vê aviso; após 7 dias Configurações é bloqueado.

## LGPD

Os dados dos sócios (nome, CPF, e-mail, telefone, participação e aportes) têm base legal em **execução de contrato** societário. CPF e telefone são criptografados em repouso (`cfg_secrets.encryption_key`). O CPF aparece mascarado (`123.***.***-00`); a revelação é registrada na auditoria. Contas desativadas não são apagadas — a trilha continua legível porque `autor_nome` é desnormalizado.

Não registre senha, token, CPF completo ou dado sensível em log.
