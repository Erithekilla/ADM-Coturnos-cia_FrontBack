# Arquitetura de Segurança, Controle de Acesso e Proteção de Dados

Este documento estabelece as diretrizes técnicas, arquiteturais e operacionais de segurança implementadas no backend (**Laravel 11**), com foco rigoroso em **controle de acesso baseado em papéis (RBAC)**, **verificação estrita de privilégios administrativos**, **ofuscação e criptografia de identificadores (IDs)** e **criptografia de dados sensíveis em repouso no banco de dados** (conformidade com a LGPD e PCI-DSS).

---

## 1. Princípios Gerais de Segurança da Arquitetura

O ecossistema adota os preceitos de **Defesa em Profundidade (Defense-in-Depth)**, **Privilégio Mínimo (Least Privilege)** e **Confiança Zero (Zero Trust)** interna:

- **Autenticação Stateless e Desacoplada:** Validação rigorosa de tokens de requisição em cada chamada à API via Bearer Token.
- **Autorização em Múltiplas Camadas para Administradores:** O acesso a áreas e rotas restritas exige verificação conjunta de token, status de ativação da conta e perfil de acesso no banco de dados.
- **Ofuscação Criptográfica de IDs:** Eliminação da exposição de chaves primárias inteiras sequenciais (`1, 2, 3...`) nas interfaces públicas para mitigar ataques de enumeração em lote e IDOR (*Insecure Direct Object Reference*).
- **Criptografia Forte em Repouso:** Proteção de PII (*Personally Identifiable Information*) com cifras AES-256 e técnicas de *Blind Indexing* para permitir consultas indexadas sem expor o texto plano.
- **Trilha de Auditoria Imutável:** Rastreabilidade completa de todas as mutações e acessos a dados sensíveis executados por contas com privilégio elevado.

---

## 2. Controle de Acesso e Verificação Estrita de Administrador (RBAC)

O backend possui áreas e endpoints críticos destinados exclusivamente à gestão operacional da plataforma (`/api/v1/admin/*`), como controle de catálogo, alteração de status de pedidos, parametrização de estoques e auditoria de usuários.

### 2.1 Camadas de Verificação de Administrador (Defesa em Profundidade)

Para garantir que nenhuma requisição não autorizada execute ações administrativas, a verificação ocorre em 4 barreiras obrigatórias e sequenciais:

```
[Requisição HTTP]
       │
       ▼
┌────────────────────────────────────────┐
│ 1. Validação do Token de Acesso        │ ──▶ Inválido/Expirado ──▶ HTTP 401 Unauthorized
└────────────────────────────────────────┘
       │ Válido
       ▼
┌────────────────────────────────────────┐
│ 2. Checagem de Integridade da Conta    │ ──▶ Inativo/Excluído  ──▶ HTTP 403 Forbidden
│ (status = 'ativo' & excluido != 'S')   │
└────────────────────────────────────────┘
       │ Conta Íntegra
       ▼
┌────────────────────────────────────────┐
│ 3. Verificação Estrita de Role         │ ──▶ Role != 'admin'   ──▶ HTTP 403 Forbidden
│ ($user->role === 'admin')              │
└────────────────────────────────────────┘
       │ Papel Confirmado
       ▼
┌────────────────────────────────────────┐
│ 4. Verificação de Token Abilities      │ ──▶ Sem ability 'admin' ─▶ HTTP 403 Forbidden
│ (Sanctum: $token->can('admin'))        │
└────────────────────────────────────────┘
       │ Aprovado em Todas
       ▼
[Execução do Controller Administrativo]
```

1. **Validação de Assinatura e Expiração:** O token de requisição é validado contra falsificação e tempo de vida.
2. **Checagem de Integridade e Status:** O usuário associado ao token é carregado do banco de dados para atestar que a conta permanece ativa (`status === 'ativo'`) e não foi deletada de forma lógica (`excluido != 'S'`). Contas suspensas têm seu acesso revogado instantaneamente.
3. **Verificação Estrita de Perfil (`role`):** Confirmação explícita de que a coluna `role` do registro autenticado possui valor idêntico a `'admin'`, comparado de forma tipada e imutável.
4. **Escopo do Token (*Abilities*):** Mesmo que um usuário seja administrador, requisições com tokens emitidos para escopos específicos/limitados são barradas se não possuírem a habilidade administrativa correspondente.

### 2.2 Middleware de Autorização Administrativa (`EnsureUserIsAdmin`)

A guarda dos endpoints restritos é realizada pelo middleware dedicado [`EnsureUserIsAdmin.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/app/Http/Middleware/EnsureUserIsAdmin.php):

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // 1. Rejeita requisições não autenticadas
        if (!$user) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Não autenticado. Credenciais ausentes ou inválidas.'
            ], 401);
        }

        // 2. Bloqueia contas inativas ou excluídas logicamente
        $status = strtolower((string) ($user->status ?? 'ativo'));
        $excluido = strtoupper(trim((string) ($user->excluido ?? 'N')));

        if ($status !== 'ativo' || $excluido === 'S') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Conta suspensa, inativa ou desativada pelo sistema.'
            ], 403);
        }

        // 3. Validação estrita do papel administrativo
        if (strtolower((string) $user->role) !== 'admin') {
            return response()->json([
                'status'  => 'error',
                'message' => 'Acesso proibido. Apenas administradores possuem autorização para executar esta ação.'
            ], 403);
        }

        // 4. Verificação de Token Ability (se o driver Sanctum estiver ativo na requisição)
        if (method_exists($user, 'currentAccessToken') && $user->currentAccessToken()) {
            if (!$user->tokenCan('admin') && !$user->tokenCan('*')) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Token de acesso sem privilégios administrativos suficientes.'
                ], 403);
            }
        }

        return $next($request);
    }
}
```

O middleware é registrado como alias `'admin'` no pipeline do Laravel 11 em [`bootstrap/app.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/bootstrap/app.php):

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias([
        'admin' => \App\Http\Middleware\EnsureUserIsAdmin::class,
    ]);
})
```

E deve envelopar **todas** as rotas sob o prefixo `/api/v1/admin/*` em [`routes/api.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/routes/api.php):

```php
Route::prefix('v1/admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('dashboard', [AdminDashboardController::class, 'dashboard']);
    Route::get('logs', [AdminDashboardController::class, 'logs']);
    Route::post('produtos', [AdminProdutoController::class, 'store']);
    Route::put('produtos/{id}', [AdminProdutoController::class, 'update']);
    Route::delete('produtos/{id}', [AdminProdutoController::class, 'destroy']);
    Route::patch('pedidos/{id}/status', [AdminPedidoController::class, 'updateStatus']);
    Route::get('usuarios', [AdminUsuarioController::class, 'index']);
    Route::patch('usuarios/{id}/toggle-status', [AdminUsuarioController::class, 'toggleStatus']);
    Route::patch('usuarios/{id}/toggle-role', [AdminUsuarioController::class, 'toggleRole']);
});
```

### 2.3 Prevenção contra Escalonamento de Privilégios (*Privilege Escalation*)

Para impedir que atacantes promovam contas comuns a administradores ou manipulem papéis:

1. **Proteção de Mass Assignment:**
   O atributo `role` é estritamente controlado. Em modelos públicos de autoatendimento ou cadastro de clientes, os campos `role`, `status` e `excluido` **jamais** constam em arrays `$fillable` de preenchimento indiscriminado.
2. **Mutação Restrita de Privilégios:**
   Alterações de privilégios (`toggleRole`) só podem ser disparadas a partir de endpoints administrativos restritos. A aplicação impede auto-revogação acidental (o último administrador ativo não pode se despromover) e exige que a ação seja executada por outro administrador autenticado.
3. **Desacoplamento de Permissões no Frontend:**
   O frontend nunca toma decisões de segurança soberanas. Mesmo que elementos de interface sejam ocultados de clientes comuns, todas as mutações e leituras são bloqueadas e validadas pelo backend no nível do banco de dados.

### 2.4 Trilha de Auditoria Administrativa e Imutabilidade (`AuditLog`)

Qualquer operação de escrita, exclusão ou alteração de estado disparada por um administrador é registrada obrigatoriamente na tabela `audit_logs` através do modelo [`AuditLog.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/app/Models/AuditLog.php):

- **Campos Auditados:**
  - `admin_user_id`: Identificador do administrador que executou a ação.
  - `action`: Verbo ou comando operacional (ex: `UPDATE_PRODUCT`, `CHANGE_ORDER_STATUS`, `TOGGLE_USER_ROLE`).
  - `table_affected`: Tabela do banco de dados impactada.
  - `record_id`: Identificador do registro modificado.
  - `old_values`: Snapshot do estado anterior em JSON.
  - `new_values`: Snapshot do estado posterior em JSON.
  - `ip_address`: Endereço IP de origem da requisição administrativa.
  - `created_at`: Carimbo de data/hora imutável gerado pelo banco.
- **Sanitização de Logs de Auditoria:**
  Antes de gravar os snapshots `old_values` e `new_values`, funções de filtro mascaram dados sensíveis (senhas, CPFs, números de cartão de crédito e dados de contato), impedindo que a auditoria se torne um vetor de vazamento de credenciais ou dados sob sigilo da LGPD.
- **Imutabilidade Estrutural:** A API não disponibiliza rotas para `UPDATE` ou `DELETE` na tabela `audit_logs`. Os registros são apenas inseridos (*append-only*), garantindo integridade forense.

---

## 3. Criptografia e Ofuscação de Identificadores (Anti-IDOR e Anti-Scraping)

A exposição direta de chaves primárias inteiras sequenciais (`id = 1, 2, 3...`) em URLs ou payloads de API representa uma falha crítica de segurança e inteligência competitiva:
- **Enumeração Automatizada (*Resource Scraping*):** Permite que concorrentes ou invasores realizem varreduras automáticas em `/pedidos/1`, `/pedidos/2` para extrair registros completos.
- **Vazamento de Métricas Estratégicas:** Pelo ID incremental do último pedido, qualquer terceiro consegue calcular exatamente o volume total de vendas e o crescimento da empresa.
- **Facilitação de IDOR:** Facilita adivinhação de registros e testes de vulnerabilidade em massa.

Para solucionar essas fraquezas, o sistema adota padrões consolidados de proteção de identificadores:

### 3.1 Identificadores Universais Criptográficos (UUIDv7 e UUIDv4)

Em entidades críticas (como Pedidos, Pagamentos e Sessões), substitui-se ou complementa-se o ID auto-incremental por UUIDs criptograficamente aleatórios:

```php
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Pedido extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    // UUIDv7 garante aleatoriedade criptográfica combinada com ordenação cronológica
    public function newUniqueId(): string
    {
        return (string) \Illuminate\Support\Str::orderedUuid();
    }
}
```

*Vantagens do UUIDv7 (`Str::orderedUuid()`):*
- Os primeiros 48 bits derivam do carimbo de época (timestamp), preservando a ordenação natural em índices B-Tree no MySQL/PostgreSQL sem provocar fragmentação de páginas em disco.
- Os 74 bits restantes são entropia criptograficamente aleatória, tornando virtualmente impossível adivinhar ou prever o próximo identificador gerado.

### 3.2 Ofuscação Reversível de Chaves Primárias via Hashids / Cifras Simétricas

Para entidades existentes que utilizam chave primária inteira no banco de dados, os identificadores são codificados de forma reversível e segura antes de serem expostos à API externa:

- **Codificação com Salt do Sistema:**
  O backend gera um hash compacto a partir do ID inteiro, utilizando uma chave secreta exclusiva do servidor derivada de `config('app.key')`:
  ```
  ID Real no Banco (10842) ──▶ Cifra com Salt do Servidor ──▶ ID Público ("k9XmQ7a")
  ID Público ("k9XmQ7a") ──▶ Decodificação Interna Segura ──▶ ID Real no Banco (10842)
  ```
- **Resolução Automática no Eloquent:**
  Ao receber uma rota como `GET /api/v1/pedidos/{hashid}`, o sistema decodifica o identificador na camada de resolução de rota (*Route Model Binding*). Caso a string seja adulterada ou a soma de verificação falhe, a aplicação rejeita a requisição imediatamente com `HTTP 404 Not Found`.

### 3.3 Mitigação de IDOR com Escopo Obrigatório

Mesmo com IDs ofuscados ou UUIDs, a aplicação aplica a política de **escopo rígido de propriedade** em todos os endpoints de clientes:

1. **Consulta Sempre Encadeada pelo Usuário Autenticado:**
   ```php
   // VULNERÁVEL A IDOR (NUNCA UTILIZAR):
   // $pedido = Pedido::findOrFail($id);

   // SEGURO E EM CONFORMIDADE:
   $pedido = $request->user()->pedidos()->findOrFail($idReal);
   ```
2. **Resposta 404 em vez de 403:**
   Caso o recurso exista no sistema mas pertença a outro usuário, a resposta retornada é `404 Not Found` (e não `403 Forbidden`). Isso impede que invasores usem mensagens de erro para deduzir se um identificador é real no banco.

---

## 4. Criptografia de Dados Sensíveis no Banco de Dados (Repouso e LGPD)

Em atendimento à Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e às normas internacionais de segurança da informação, dados sensíveis em repouso no banco de dados são cifrados em nível de campo.

### 4.1 Criptografia em Repouso no Eloquent (AES-256-CBC)

Campos contendo informações pessoais identificáveis (PII) e contatos confidenciais são gravados cifrados no banco com o algoritmo **AES-256-CBC**, assinado via **HMAC-SHA256** para garantir autenticidade e impedir adulteração dos dados cifrados.

No modelo [`Usuario.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/app/Models/Usuario.php) e [`User.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/app/Models/User.php):

```php
protected function casts(): array
{
    return [
        'cpf'             => 'encrypted',
        'telefone'        => 'encrypted',
        'data_nascimento' => 'encrypted',
        'password'        => 'hashed',
        'status'          => 'string',
        'role'            => 'string',
    ];
}
```

- Cada gravação gera um vetor de inicialização (*IV*) aleatório e exclusivo. Portanto, duas entradas com o mesmo dado bruto resultarão em sequências criptografadas completamente distintas no banco de dados, frustrando ataques estatísticos ou tabelas rainbow.

### 4.2 Blind Indexing com HMAC-SHA256 (`cpf_hash` e `email_hash`)

Como a criptografia probabilística (AES com IV aleatório) torna impossível a indexação direta ou o uso de constraints `UNIQUE` via SQL convencional (`WHERE cpf = '...'`), o sistema adota a técnica de **Blind Indexing**:

```
[Entrada: CPF do Usuário]
          │
          ├─────────────────────────▶ Criptografia AES-256 ──▶ Coluna `cpf` (Dado Seguro)
          │
          ▼
[Limpeza de pontuação: 12345678901]
          │
          ▼
[HMAC-SHA256 com chave secreta]
          │
          ▼
[Hash Criptográfico Determinístico] ──▶ Coluna `cpf_hash` (Índice Rápido B-Tree / UNIQUE)
```

**Implementação do Blind Index:**

```php
public static function generateCpfHash(?string $cpf): ?string
{
    if (empty($cpf)) {
        return null;
    }
    // Remove qualquer máscara de formatação
    $clean = preg_replace('/\D/', '', (string) $cpf);
    
    // Gera hash criptográfico assinado com a chave da aplicação
    return hash_hmac('sha256', $clean, (string) config('app.key'));
}
```

*Vantagens de Segurança:*
- **Busca em O(1):** Consultas para verificar existência ou duplicidade de CPF são executadas via `WHERE cpf_hash = :hash`, mantendo máxima velocidade de leitura no banco.
- **Não Reversibilidade:** O atacante que tiver acesso a um vazamento da base não consegue decifrar o CPF a partir do hash sem a chave secreta da aplicação (`APP_KEY`).

### 4.3 Dados Financeiros e Conformidade Estrita PCI-DSS

Para a gestão de pagamentos em e-commerce:

1. **Zero Retenção de Dados de Cartão:**
   A aplicação e o banco de dados **nunca** recebem, trafegam ou armazenam números completos de cartão de crédito (PAN), códigos de verificação (CVV/CVC) ou senhas bancárias.
2. **Tokenização Segura:**
   Toda transação financeira delega a captura dos dados diretamente ao gateway homologado (ex: Mercado Pago, Pagar.me, Stripe) via SDK cliente.
3. **Persistência Exclusiva de Tokens de Transação:**
   A tabela `pagamentos` armazena unicamente:
   - Identificador da transação no gateway (`payment_intent_id`, `charge_id`).
   - Método utilizado (`pix`, `cartao_credito`, `boleto`).
   - Dados truncados e não sensíveis para conferência pelo titular: últimos 4 dígitos (`last_four_digits = '4242'`) e bandeira (`brand = 'visa'`).

### 4.4 Imutabilidade e Integridade do Identificador Fiscal

O CPF de um usuário é um atributo fiscal definitivo. Para evitar que adulterações acidentais ou ataques de injeção alterem a titularidade de contas registradas, o modelo bloqueia modificações através de hooks de ciclo de vida do Eloquent:

```php
protected static function booted(): void
{
    static::updating(function (Usuario $usuario) {
        if ($usuario->isDirty('cpf') && !empty($usuario->getOriginal('cpf'))) {
            throw new \InvalidArgumentException('Violação de integridade: o CPF não pode ser alterado após o registro inicial.');
        }
    });
}
```

### 4.5 Proteção de Serialização (Campos Ocultos em Respostas de API)

Campos com dados sensíveis, hashes de indexação ou dados internos de autenticação devem ser blindados contra exposição em retornos JSON.

No modelo:

```php
protected $hidden = [
    'senha',
    'password',
    'remember_token',
    'cpf_hash',
    'cpf',             // Descriptografado apenas sob demanda e nunca em listagens em massa
    'google_id',
];
```

Listagens de usuários pelo painel administrativo (`AdminUsuarioController`) removem explicitamente senhas e metadados confidenciais antes do envio ao cliente frontend.

---

## 5. Gerenciamento Seguro de Chaves e Políticas de Rotação

A robustez da criptografia depende diretamente do controle seguro das chaves de cifra:

- **Armazenamento de Segredos:**
  A chave mestre (`APP_KEY`) nunca é versionada no controle de código-fonte (Git). Permanece exclusivamente em variáveis de ambiente seguras no servidor de produção.
- **Suporte a Rotação de Chaves no Laravel 11:**
  O Laravel 11 suporta chaves prévias através da variável `APP_PREVIOUS_KEYS` (lista separada por vírgulas). Durante uma rotação planejada de chave de segurança:
  1. A chave atual é movida para `APP_PREVIOUS_KEYS`.
  2. Uma nova `APP_KEY` é gerada com `php artisan key:generate`.
  3. O sistema continua decifrando registros antigos usando a chave anterior enquanto salva novos registros com a nova chave.
  4. Um comando de re-encriptação de lote atualiza todos os registros legados para a nova cifra sem interromper o serviço.

---

## 6. Proteções de Infraestrutura, Rate Limiting e CORS

### 6.1 Rate Limiting Reforçado para Endpoints Administrativos

Endpoints do prefixo `/api/v1/admin/*` possuem limitador de vazão isolado e restritivo em [`app/Providers/AppServiceProvider.php`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/app/Providers/AppServiceProvider.php):

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;

RateLimiter::for('admin-api', function (Request $request) {
    // Limite de 60 requisições por minuto por administrador autenticado ou IP
    $key = $request->user()?->id ? 'admin_' . $request->user()->id : $request->ip();
    return Limit::perMinute(60)->by($key)->response(function () {
        return response()->json([
            'status'  => 'error',
            'message' => 'Muitas requisições administrativas. Limite de segurança atingido. Aguarde antes de tentar novamente.'
        ], 429);
    });
});
```

### 6.2 Isolamento de CORS e Headers de Segurança

- **CORS ([config/cors.php](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Site/backend-api/config/cors.php)):**
  - Apenas as origens explícitas do painel administrativo e da loja são aceitas na lista de origens autorizadas (`allowed_origins`).
  - Requisições provenientes de origens não catalogadas são bloqueadas pelo servidor web/API.
- **Headers de Defesa Ativa:**
  - `X-Content-Type-Options: nosniff`: Impede interpretação incorreta de MIME types.
  - `X-Frame-Options: DENY`: Prevenção contra ataques de Clickjacking no painel e na loja.
  - `Strict-Transport-Security (HSTS)`: Obrigatoriedade estrita de comunicação via HTTPS cifrado com TLS 1.3.
