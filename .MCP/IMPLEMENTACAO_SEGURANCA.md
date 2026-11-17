# Implementação das Diretrizes de Segurança — Status e Passo a Passo

Este documento registra o que foi implementado a partir de `SEGURANCA_E_AUTENTICACAO.md` e
`GUIA_CRIPTOGRAFIA_E_DESCRIPTOGRAFIA_ADMIN.md`, e os comandos necessários para ativar tudo.

> No painel admin, os dados de clientes ficam na tabela legada **`usuario`** (model `App\Models\Usuario`),
> e não em `users`. As regras do guia foram aplicadas a ela.

---

## 1. Ativação (executar uma vez, nesta ordem)

```bash
cd backend-api

# 1) Faça BACKUP do banco antes (a migration altera colunas da tabela usuario)
mysqldump -u root -p Coturno_Cia > backup_antes_seguranca.sql

# 2) Migration de segurança (idempotente). Rode só ela, pois o histórico de migrations antigas é duplicado:
php artisan migrate --path=database/migrations/2026_10_31_000001_harden_security_columns.php

# 3) Cifra CPF/telefone/nascimento legados e preenche cpf_hash (simule antes com --dry-run)
php artisan seguranca:criptografar-dados --dry-run
php artisan seguranca:criptografar-dados

# 4) Garante um administrador ativo (defina ADMIN_SEED_PASSWORD no .env ou anote a senha exibida)
php artisan db:seed --class=AdminUserSeeder

# 5) Limpa caches e roda os testes de segurança
php artisan optimize:clear
php artisan test

# 6) Recompila o painel (o build vai para backend-api/public/admin)
cd "../front-end admin/Admin_Coturno-main"
npm run build
```

> ⚠️ **Nunca** rode `php artisan key:generate` em um banco com dados: CPFs, telefones, `cpf_hash`
> e IDs públicos dependem da `APP_KEY`. Para trocar a chave, siga a seção 5.

---

## 2. O que foi implementado

| Diretriz | Implementação |
| :--- | :--- |
| 2.1 Quatro barreiras de admin | `EnsureUserIsAdmin` (401 → conta ativa → `role === 'admin'` → ability `admin`), com `code` legível pelo front |
| 2.2 Rotas protegidas | `routes/api.php`: públicas só `auth/login` e `auth/register`; carrinho exige `auth:sanctum`; **todo o resto** exige `auth:sanctum` + `admin` + `throttle:admin-api` |
| Autenticação | Sanctum (token guardado só como SHA-256), expira em `SANCTUM_EXPIRATION` min (padrão 8h); logout revoga o token |
| 2.3 Escalonamento de privilégio | `role`/`status`/`excluido` fora do `$fillable`; `UserPrivilegeService` impede auto-alteração e despromover/desativar o último admin; tokens do alvo revogados |
| 2.4 Auditoria | `AuditLogger` grava `admin_user_id, action, table_affected, record_id, old_values, new_values, ip_address` (+ colunas legadas do painel); sanitiza senha/CPF/e-mail/telefone/cartão; `AuditLog` é append-only. Login, logout, falhas de login e visualização de dados sensíveis também são auditados |
| 3.2 IDs ofuscados | `App\Support\Hashid`: AES-128 de bloco único + etiqueta HMAC por tabela; ID público de 22 caracteres; adulterado/inteiro cru → **404**; aceita chaves de `APP_PREVIOUS_KEYS`. Aplicado a Usuario, Pedido, Produto, Endereco, Pagamento (inclusive nas FKs do JSON) |
| 3.3 Escopo obrigatório | Carrinho usa só o dono do token (removida a impersonação via `usuario_id`) |
| 4.1 Criptografia em repouso | Cast `SafeEncrypted` (AES-256-CBC + HMAC, compatível com `Crypt::decryptString`) em `cpf`, `telefone`, `data_nascimento`; tolera legado em texto plano até o comando rodar |
| 4.2 Blind Index | `usuario.cpf_hash` (HMAC-SHA256, UNIQUE); `Usuario::findByCpf()`; busca do admin por CPF |
| 4.4 CPF imutável | Hook `updating` + validação 422 no controller |
| 4.5 Serialização | `cpf`, `cpf_hash`, `senha`, `google_id` ocultos; listagens mostram CPF mascarado (`***.456.789-**`) |
| 6.1 Rate limit | `admin-api` 60/min por admin; login 5/min por e-mail+IP e 20/min por IP; cadastro 3/min |
| 6.2 CORS e headers | Origens em `CORS_ALLOWED_ORIGINS`; `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS em HTTPS, `Cache-Control: no-store` na API |

### Endpoints administrativos novos

- `GET  /api/v1/admin/usuarios/{id}` — ficha com CPF/telefone/nascimento descriptografados (auditado)
- `GET  /api/v1/admin/usuarios/buscar-cpf?cpf=...` — localiza cliente pelo Blind Index

### Painel (front-end)

- Tela `/admin/login`, guarda de rotas (`RequireAuth`) que confirma a sessão em `/auth/me`.
- `src/lib/auth.ts` anexa `Authorization: Bearer` a todo `fetch('/api/...')` e manda para o login em 401 ou perda de privilégio.
- "Sair" revoga o token no servidor.
- Gestão de usuários: deixou de enviar `senha: 'password123'` (antes, **toda edição redefinia a senha do usuário**); na criação o servidor gera uma senha temporária exibida uma vez; o campo CPF fica bloqueado quando já existe.

---

## 3. Mudanças de comportamento a conhecer

- O painel precisa de login. Sem token, todas as rotas respondem 401.
- IDs nas respostas agora são strings (`"bffAb27ZIunFH3l-eKDUeQ"`), inclusive `usuario_id`, `pedido_id`, `produtos_id`. Quem enviar FKs (ex.: `POST /precos`) deve mandar o ID público.
- O endpoint `/admin/logs` não inventa mais eventos quando a tabela está vazia.
- Erros 500 só mostram `error_detail` com `APP_DEBUG=true`.

---

## 4. Rotação de chave (seção 5 do guia)

```bash
# .env: APP_PREVIOUS_KEYS=<chave atual>
php artisan key:generate
php artisan seguranca:criptografar-dados --recriptografar
```

Os IDs públicos mudam com a nova chave, mas os antigos continuam sendo aceitos enquanto a chave anterior estiver em `APP_PREVIOUS_KEYS`.
