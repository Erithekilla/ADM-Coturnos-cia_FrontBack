# Guia de Criptografia e Descriptografia para o Painel Administrativo

Este documento detalha todos os comandos, métodos, colunas e algoritmos criptográficos utilizados neste projeto em **Laravel 11**, fornecendo os procedimentos e códigos exatos para que a equipe de **Administração (Admin)** possa descriptografar e acessar os dados em texto claro.

---

## 1. Resumo Geral das Operações Criptográficas

| Dado / Coluna | Onde está no código | Algoritmo / Mecanismo | Reversível pelo Admin? | Como reverter / acessar em texto claro |
| :--- | :--- | :--- | :---: | :--- |
| **CPF** (`users.cpf`) | [User.php](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Coturnos-Cia_Back-end_Cliente-main/Coturnos-Cia_Back-end_Cliente-main/app/Models/User.php#L74) | **AES-256-CBC** (`'encrypted'`) | **SIM** | Nativo via Eloquent ou `Crypt::decryptString()` |
| **Telefone** (`users.phone`) | [User.php](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Coturnos-Cia_Back-end_Cliente-main/Coturnos-Cia_Back-end_Cliente-main/app/Models/User.php#L75) | **AES-256-CBC** (`'encrypted'`) | **SIM** | Nativo via Eloquent ou `Crypt::decryptString()` |
| **Blind Index do CPF** (`users.cpf_hash`) | [User.php](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Coturnos-Cia_Back-end_Cliente-main/Coturnos-Cia_Back-end_Cliente-main/app/Models/User.php#L109-L118) | **HMAC-SHA256** unidirecional | **NÃO** *(Hash)* | Não precisa reverter; usado pelo Admin para buscar clientes por CPF |
| **Senha** (`users.password`) | [User.php](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Coturnos-Cia_Back-end_Cliente-main/Coturnos-Cia_Back-end_Cliente-main/app/Models/User.php#L71) | **Bcrypt / Argon2id** (`'hashed'`) | **NÃO** *(Hash)* | Por padrão de segurança OWASP, senhas são one-way. O Admin pode redefini-la |
| **Tokens de API** (`personal_access_tokens.token`) | Migrations Sanctum | **SHA-256** unidirecional | **NÃO** *(Hash)* | O Admin revoga tokens; não é possível ler o token original emitido |

---

## 2. Dados Reversíveis: CPF e Telefone (AES-256-CBC)

### 2.1 Como e onde foram criptografados
No model [`User`](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Coturnos-Cia_Back-end_Cliente-main/Coturnos-Cia_Back-end_Cliente-main/app/Models/User.php#L67-L77), os campos utilizam o cast nativo de criptografia do Laravel:
```php
protected function casts(): array
{
    return [
        'cpf'   => 'encrypted',   // Criptografia AES-256-CBC vinculada ao APP_KEY
        'phone' => 'encrypted',   // Criptografia AES-256-CBC vinculada ao APP_KEY
    ];
}
```

No banco de dados bruto (`database/migrations/2026_09_01_000001_create_users_table.php`), esses campos são armazenados como strings serializadas em Base64 contendo `{"iv":"...", "value":"...", "mac":"..."}`.

### 2.2 Como o Admin reverte (Método 1: Automático via Eloquent)
Quando o Admin consulta o usuário utilizando a model Eloquent `User`, o próprio Laravel **descriptografa os dados automaticamente em memória**:

```php
use App\Models\User;

$user = User::findOrFail($id);

// O Laravel descriptografa automaticamente ao acessar as propriedades:
$cpfOriginal      = $user->cpf;    // Ex: "123.456.789-00"
$telefoneOriginal = $user->phone;  // Ex: "(11) 98765-4321"
```

> **Atenção:** Como `cpf` e `phone` estão protegidos na propriedade `$hidden` da model (para não vazarem na API do cliente), caso o controller do painel administrativo vá retornar o usuário em formato JSON, deve torná-los visíveis explicitamente:
> ```php
> return response()->json([
>     'user' => $user->makeVisible(['cpf', 'phone'])
> ]);
> ```

---

### 2.3 Como o Admin reverte (Método 2: Manual com `Illuminate\Support\Facades\Crypt`)
Se o painel administrativo executar queries brutas via `DB::table('users')`, SQL nativo ou scripts de exportação direta (sem passar pelo Eloquent):

```php
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Encryption\DecryptException;

$rawUser = DB::table('users')->where('id', $id)->first();

try {
    // Comando explícito de descriptografia:
    $cpfClaro = Crypt::decryptString($rawUser->cpf);
    $phoneClaro = Crypt::decryptString($rawUser->phone);
} catch (DecryptException $e) {
    // Ocorre se o dado estiver corrompido ou se o APP_KEY tiver sido alterado
    $cpfClaro = null;
    $phoneClaro = null;
}
```

---

### 2.4 Como o Admin criptografa um novo valor manualmente
Se o painel administrativo precisar atualizar ou inserir o CPF/telefone de um cliente sem usar a model:

```php
use Illuminate\Support\Facades\Crypt;

$cpfCriptografado = Crypt::encryptString('123.456.789-00');
$phoneCriptografado = Crypt::encryptString('(11) 98765-4321');

DB::table('users')->where('id', $id)->update([
    'cpf'   => $cpfCriptografado,
    'phone' => $phoneCriptografado,
]);
```

---

## 3. Blind Index: Como o Admin faz Buscas por CPF (`cpf_hash`)

Como o `cpf` está gravado de forma cifrada (onde o mesmo CPF gera textos criptografados diferentes a cada salvamento devido ao vetor de inicialização `iv` aleatório), o banco possui a coluna `cpf_hash`.

### 3.1 Algoritmo e Comando Utilizado
Implementado em [User.php](file:///c:/Users/monta/Documents/A%20porra%20dos%20coturnos/Coturnos-Cia_Back-end_Cliente-main/Coturnos-Cia_Back-end_Cliente-main/app/Models/User.php#L109-L118):
```php
public static function generateCpfHash(?string $cpf): ?string
{
    if (empty($cpf)) {
        return null;
    }
    $clean = preg_replace('/\D/', '', (string) $cpf);
    return hash_hmac('sha256', $clean, (string) config('app.key'));
}
```

### 3.2 Como o Admin pesquisa um cliente pelo CPF
O Admin não precisa reverter o hash do CPF. Para encontrar o cliente, gera-se o hash do CPF pesquisado e faz-se a busca indexada imediata:

```php
use App\Models\User;

// Opção A: Usando o helper nativo da Model
$user = User::findByCpf('123.456.789-00');

if ($user) {
    echo "Usuário encontrado: " . $user->first_name;
    echo "CPF descriptografado: " . $user->cpf;
}

// Opção B: Manual via Query Builder
$cpfInput = '123.456.789-00';
$hash = User::generateCpfHash($cpfInput);

$user = User::where('cpf_hash', $hash)->first();
```

---

## 4. Dados Não Reversíveis (Hashes Criptográficos)

### 4.1 Senhas (`users.password`)
* **Mecanismo:** Hash adaptativo via Bcrypt/Argon2id gerado pelo cast `'password' => 'hashed'` ou `Hash::make($senha)`.
* **Por que não é reversível?** Hashes de senha são projetados para serem irreversíveis por normas de segurança internacionais (OWASP). Ninguém (nem mesmo administradores do sistema ou com acesso root ao banco) deve ter acesso à senha original em texto puro.
* **Operação permitida ao Admin:** O admin pode **redefinir** a senha de um usuário:
  ```php
  $user = User::findOrFail($userId);
  $user->password = 'NovaSenhaTemporaria123!'; // O cast 'hashed' gera o hash automaticamente
  $user->save();

  // Derruba todas as sessões anteriores do usuário por segurança:
  $user->tokens()->delete();
  ```

### 4.2 Tokens de Acesso Sanctum (`personal_access_tokens`)
* **Mecanismo:** Ao gerar o token, o cliente recebe o valor em texto puro uma única vez (`$user->createToken(...)->plainTextToken`). O banco armazena apenas `hash('sha256', $plainTextToken)`.
* **Operação permitida ao Admin:** O admin não pode ler o token do usuário, mas pode **revogar** o acesso a qualquer momento:
  ```php
  // Revoga todos os tokens do cliente
  $user->tokens()->delete();

  // Ou revoga um token específico pelo ID
  $user->tokens()->where('id', $tokenId)->delete();
  ```

---

## 5. Exemplo Completo: Controller de Consulta para Painel Admin

Abaixo está um exemplo pronto de como construir um endpoint na área administrativa que localiza o usuário e devolve os dados sensíveis já descriptografados com segurança:

```php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCustomerController extends Controller
{
    /**
     * Exibe os dados completos do cliente, incluindo dados sensíveis descriptografados.
     */
    public function show(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        return response()->json([
            'id'         => $user->id,
            'name'       => $user->full_name,
            'email'      => $user->email,
            'role'       => $user->role->value,
            'active'     => $user->active,
            // Campos descriptografados em texto claro:
            'cpf'        => $user->cpf,
            'phone'      => $user->phone,
            'birth_date' => $user->birth_date?->format('Y-m-d'),
            'created_at' => $user->created_at->toIso8601String(),
        ]);
    }

    /**
     * Localiza cliente diretamente por CPF informado no filtro de busca do Admin.
     */
    public function searchByCpf(Request $request): JsonResponse
    {
        $request->validate(['cpf' => 'required|string']);

        $user = User::findByCpf($request->input('cpf'));

        if (! $user) {
            return response()->json(['message' => 'Cliente não encontrado.'], 404);
        }

        return $this->show($user->id);
    }
}
```

---

## 6. Cuidados Críticos de Infraestrutura (`APP_KEY`)

> [!CAUTION]
> **A chave `APP_KEY` do arquivo `.env` nunca deve ser alterada ou perdida.**
> - Toda a criptografia simétrica reversível (`users.cpf` e `users.phone`) e o Blind Index (`cpf_hash`) dependem diretamente do valor de `APP_KEY`.
> - Se o comando `php artisan key:generate` for executado em produção sem um plano de rotação e recriptografia de base de dados, **todos os CPFs e telefones cadastrados ficarão corrompidos e permanentemente irrecuperáveis**.

