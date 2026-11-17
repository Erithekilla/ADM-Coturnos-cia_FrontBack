<?php

namespace App\Http\Presenters;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UserPresenter
{
    /** user_id => provedor social (carregado uma vez por requisição). */
    private static ?array $socialProviders = null;

    /** "Google", "Facebook"... quando a conta veio de login social; senão "Local". */
    public static function providerLabel(User $u): string
    {
        if (self::$socialProviders === null) {
            self::$socialProviders = Schema::hasTable('social_accounts')
                ? DB::table('social_accounts')->pluck('provider_name', 'user_id')->all()
                : [];
        }

        $provider = self::$socialProviders[$u->getKey()] ?? null;

        return $provider ? ucfirst((string) $provider) : 'Local';
    }

    public static function listItem(User $u): array
    {
        $address = $u->relationLoaded('addresses') ? $u->addresses->first() : ($u->relationLoaded('enderecos') ? $u->enderecos->first() : null);
        $isAtivo = strtolower((string) ($u->status ?? 'ativo')) !== 'inativo';

        return [
            'id' => $u->hashid,
            'first_name' => $u->first_name,
            'last_name' => $u->last_name,
            'firstName' => $u->first_name,
            'lastName' => $u->last_name,
            'nome' => $u->first_name,
            'sobrenome' => $u->last_name,
            'email' => $u->email,
            'cpf' => $u->maskedCpf(),
            'hasCpf' => !empty($u->getRawOriginal('cpf')),
            'phone' => self::formatPhone($u->phone),
            'zip_code' => $address->zip_code ?? '',
            'cep' => $address->zip_code ?? '',
            'street' => $address->street ?? '',
            'sreet' => $address->street ?? '',
            'number' => $address->number ?? '',
            'sreet_number' => $address->number ?? '',
            'neighborhood' => $address->neighborhood ?? '',
            'block' => $address->neighborhood ?? '',
            'city' => $address->city ?? '',
            'state' => $address->state ?? '',
            'type' => $u->isAdmin() ? 'Administrador' : 'Cliente',
            'role' => $u->role,
            'provider' => self::providerLabel($u),
            'status' => $isAtivo ? 'ativo' : 'inativo',
            'statusLabel' => $isAtivo ? 'Ativo' : 'Inativo',
            'created_at' => $u->created_at ? $u->created_at->format('Y-m-d H:i:s') : '',
            'createdAt' => $u->created_at ? $u->created_at->format('d/m/Y') : '',
        ];
    }

    public static function detail(User $u): array
    {
        return array_merge(self::listItem($u), [
            'cpf' => self::formatCpf($u->cpf),
            'phone' => self::formatPhone($u->phone),
            'birth_date' => $u->birth_date ? substr((string) $u->birth_date, 0, 10) : null,
        ]);
    }

    public static function formatCpf(?string $cpf): string
    {
        $d = User::cleanCpf($cpf) ?? '';

        return strlen($d) === 11
            ? substr($d, 0, 3) . '.' . substr($d, 3, 3) . '.' . substr($d, 6, 3) . '-' . substr($d, 9, 2)
            : $d;
    }

    public static function formatPhone(?string $phone): string
    {
        $d = preg_replace('/\D/', '', (string) $phone);

        return match (strlen($d)) {
            11 => '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 5) . '-' . substr($d, 7),
            10 => '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 4) . '-' . substr($d, 6),
            default => $d,
        };
    }
}

