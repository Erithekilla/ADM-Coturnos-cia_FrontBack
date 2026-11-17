<?php

namespace App\Support;

/**
 * Status de pedido — fonte única de verdade.
 *
 * O banco guarda só os valores em inglês (enum de orders.status). O painel
 * mostra e envia rótulos em português; esta classe converte nos dois sentidos.
 *
 * "Aprovado" = pagamento confirmado: paid e tudo que vem depois dele
 * (preparing, shipped, delivered). É a base de todas as métricas de venda.
 */
final class OrderStatus
{
    public const PENDING = 'pending';
    public const PAID = 'paid';
    public const PREPARING = 'preparing';
    public const SHIPPED = 'shipped';
    public const DELIVERED = 'delivered';
    public const CANCELLED = 'cancelled';

    public const ALL = [self::PENDING, self::PAID, self::PREPARING, self::SHIPPED, self::DELIVERED, self::CANCELLED];

    /** Pedidos que contam como venda (receita, pedidos, top produtos, clientes). */
    public const APPROVED = [self::PAID, self::PREPARING, self::SHIPPED, self::DELIVERED];

    /** Rótulos aceitos na entrada (painel, versões antigas, inglês). */
    private const ALIASES = [
        self::PENDING   => ['pending', 'pendente', 'aguardando', 'aguardando_pagamento'],
        self::PAID      => ['paid', 'pago', 'aprovado', 'approved', 'confirmado'],
        self::PREPARING => ['preparing', 'processando', 'em_separacao', 'separando', 'em_preparo', 'preparando'],
        self::SHIPPED   => ['shipped', 'enviado', 'em_transito', 'despachado', 'postado'],
        self::DELIVERED => ['delivered', 'entregue', 'concluido', 'finalizado'],
        self::CANCELLED => ['cancelled', 'canceled', 'cancelado'],
    ];

    /** Converte qualquer rótulo conhecido para o valor do banco; null se desconhecido. */
    public static function normalize(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $key = self::slug((string) $value);
        foreach (self::ALIASES as $status => $aliases) {
            if (in_array($key, $aliases, true)) {
                return $status;
            }
        }

        return null;
    }

    public static function isApproved(?string $status): bool
    {
        return in_array($status, self::APPROVED, true);
    }

    /**
     * Rótulo da coluna "Status de Envio" do painel.
     * Pedido pago mas ainda não separado continua "Pendente" no envio.
     */
    public static function shippingLabel(?string $status): string
    {
        return match ($status) {
            self::PREPARING => 'Processando',
            self::SHIPPED   => 'Enviado',
            self::DELIVERED => 'Entregue',
            self::CANCELLED => 'Cancelado',
            default         => 'Pendente',
        };
    }

    /** Rótulo da coluna "Status da Compra" (pagamento) do painel. */
    public static function purchaseLabel(?string $orderStatus, ?string $paymentStatus = null): string
    {
        if ($orderStatus === self::CANCELLED) {
            return $paymentStatus === 'refunded' ? 'Reembolsado' : 'Cancelado';
        }

        return match ($paymentStatus) {
            'approved'   => 'Aprovado',
            'in_process' => 'Processando',
            'rejected'   => 'Recusado',
            'refunded'   => 'Reembolsado',
            'cancelled'  => 'Cancelado',
            default      => self::isApproved($orderStatus) ? 'Aprovado' : 'Pendente',
        };
    }

    /**
     * Status do pedido a partir do que o painel envia em "Status de Envio".
     * "Pendente" no envio não desfaz um pagamento: pedido já aprovado volta para
     * "paid" (aguardando separação), e não para "pending".
     */
    public static function fromShippingLabel(mixed $label, ?string $current): ?string
    {
        $status = self::normalize($label);

        if ($status === self::PENDING && self::isApproved($current)) {
            return self::PAID;
        }

        return $status;
    }

    private static function slug(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = strtr($value, ['á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'õ' => 'o', 'ô' => 'o', 'ú' => 'u', 'ç' => 'c']);

        return str_replace([' ', '-'], '_', $value);
    }
}
