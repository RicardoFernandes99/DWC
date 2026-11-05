<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Exceptions\BackofficeUnavailable;

final class InspectionPayload
{
    private const ID = '/\A[a-f\d]{24}\z/i';

    private const ROLES = ['buyer', 'producer', 'admin'];

    private const PRODUCER_STATES = ['pending', 'approved', 'rejected', 'suspended'];

    private const BUYER_STATES = ['active', 'suspended'];

    private const ORDER_STATES = ['pending', 'confirmed', 'shipped', 'delivered', 'ready_for_collection', 'collected', 'cancelled'];

    private const FULFILMENT = ['delivery', 'collection'];

    private const ORIGINS = ['catalogue', 'auction'];

    private const REFUND_STATES = ['open', 'declined', 'accepted'];

    private const AUCTION_STATES = ['scheduled', 'active', 'finished', 'cancelled'];

    private const PAYMENT_STATES = ['succeeded', 'failed'];

    private const UNITS = ['unit', 'bunch', 'box', 'jar', 'bottle', 'bag', 'kg', 'g_500', 'g_250', 'l', 'ml_500'];

    private const CATEGORIES = ['vegetables', 'fruits', 'dairy', 'eggs', 'meat', 'bakery', 'pantry', 'beverages', 'other'];

    private const METHODS = ['organic', 'sustainable', 'conventional', 'artisanal', 'biodynamic'];

    private const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'year_round'];

    /** @return array<string, mixed> */
    public static function user(array $data, bool $detail = false): array
    {
        $out = [
            'id' => self::id($data, 'id'), 'name' => self::text($data, 'name', 120),
            'email' => self::text($data, 'email', 254), 'role' => self::choice($data, 'role', self::ROLES),
            'producerStatus' => self::optionalChoice($data, 'producerStatus', self::PRODUCER_STATES),
            'buyerStatus' => ($data['role'] ?? null) === 'buyer'
                ? self::choice($data, 'buyerStatus', self::BUYER_STATES)
                : self::optionalChoice($data, 'buyerStatus', self::BUYER_STATES),
            'farmName' => self::optionalText($data, 'farmName', 120),
            'city' => self::optionalText($data, 'city', 120), 'createdAt' => self::date($data, 'createdAt'),
        ];
        if ($detail) {
            if (! array_key_exists('producerApplication', $data)) {
                throw new BackofficeUnavailable;
            }
            $application = $data['producerApplication'];
            if ($application !== null && (! is_array($application)
                || ! is_string($application['farmName'] ?? null) || mb_strlen($application['farmName']) > 120
                || ! is_string($application['description'] ?? null) || mb_strlen($application['description']) > 2000
                || ! is_string($application['city'] ?? null) || mb_strlen($application['city']) > 120)) {
                throw new BackofficeUnavailable;
            }
            $out += [
                'producerApplication' => $application === null ? null : [
                    'farmName' => $application['farmName'], 'description' => $application['description'],
                    'city' => $application['city'], 'submittedAt' => self::date($application, 'submittedAt'),
                ],
                'producerRejectionReason' => self::optionalText($data, 'producerRejectionReason', 500),
                'producerSuspensionReason' => self::optionalText($data, 'producerSuspensionReason', 500),
                'producerDecisionRevision' => self::number($data, 'producerDecisionRevision', 0),
                'producerDecisionBy' => self::optionalId($data, 'producerDecisionBy'),
                'producerDecisionAt' => self::date($data, 'producerDecisionAt'),
                'updatedAt' => self::date($data, 'updatedAt'),
                'buyerSuspensionReason' => self::optionalText($data, 'buyerSuspensionReason', 500),
                'buyerDecisionRevision' => self::number($data, 'buyerDecisionRevision', 0),
                'buyerDecisionBy' => self::optionalId($data, 'buyerDecisionBy'),
                'buyerDecisionAt' => self::date($data, 'buyerDecisionAt'),
            ];
        }

        return $out;
    }

    /** @return array{id: string, status: string, revision: int, reason: ?string, decidedBy: ?string, decidedAt: ?string} */
    public static function buyerStanding(array $data): array
    {
        $status = self::choice($data, 'status', self::BUYER_STATES);
        $reason = self::optionalText($data, 'reason', 500);
        if ($status === 'suspended' && ($reason === null || trim($reason) === '')) {
            throw new BackofficeUnavailable;
        }

        return [
            'id' => self::id($data, 'id'),
            'status' => $status,
            'revision' => self::number($data, 'revision', 1),
            'reason' => $reason,
            'decidedBy' => self::id($data, 'decidedBy'),
            'decidedAt' => self::requiredDate($data, 'decidedAt'),
        ];
    }

    /** @return array<string, mixed> */
    public static function order(array $data, bool $detail = false): array
    {
        $out = [
            'id' => self::id($data, 'id'), 'checkoutId' => self::optionalId($data, 'checkoutId'),
            'auctionId' => self::optionalId($data, 'auctionId'), 'buyerId' => self::id($data, 'buyerId'),
            'producerId' => self::id($data, 'producerId'), 'paymentId' => self::id($data, 'paymentId'),
            'status' => self::choice($data, 'status', self::ORDER_STATES),
            'origin' => self::choice($data, 'origin', self::ORIGINS),
            'fulfilmentMethod' => self::choice($data, 'fulfilmentMethod', self::FULFILMENT),
            'totalCents' => self::number($data, 'totalCents', 0),
            'refundedCents' => self::number($data, 'refundedCents', 0),
            'createdAt' => self::date($data, 'createdAt'),
        ];
        if ($detail) {
            $items = self::list($data, 'items');
            $history = self::list($data, 'statusHistory');
            $out += [
                'buyer' => self::owner($data['buyer'] ?? null), 'producer' => self::owner($data['producer'] ?? null),
                'payment' => self::payment(self::requiredNullable($data, 'payment')),
                'items' => array_map(self::orderItem(...), $items),
                'statusHistory' => array_map(self::history(...), $history),
                'subtotalCents' => self::number($data, 'subtotalCents', 0),
                'deliveryFeeCents' => self::number($data, 'deliveryFeeCents', 0),
                'refundAllocation' => self::refundAllocation(self::requiredNullable($data, 'refundAllocation')),
                'refundRequest' => self::refundRequest(self::requiredNullable($data, 'refundRequest')),
                'revision' => self::number($data, 'revision', 1), 'updatedAt' => self::date($data, 'updatedAt'),
            ];
        }

        return $out;
    }

    /** @return array<string, mixed> */
    public static function auction(array $data, bool $detail = false): array
    {
        $product = $data['product'] ?? null;
        if (! is_array($product)) {
            throw new BackofficeUnavailable;
        }
        $out = [
            'id' => self::id($data, 'id'), 'producerId' => self::id($data, 'producerId'),
            'productId' => self::id($data, 'productId'), 'product' => self::product($product),
            'status' => self::choice($data, 'status', self::AUCTION_STATES),
            'startsAt' => self::requiredDate($data, 'startsAt'), 'endsAt' => self::requiredDate($data, 'endsAt'),
            'quantity' => self::number($data, 'quantity', 1),
            'currentBidCents' => self::optionalNumber($data, 'currentBidCents', 1),
            'createdAt' => self::date($data, 'createdAt'),
        ];
        if ($detail) {
            $out += [
                'producer' => self::auctionProducer($data['producer'] ?? null),
                'startingPriceCents' => self::number($data, 'startingPriceCents', 1),
                'minimumIncrementCents' => self::number($data, 'minimumIncrementCents', 1),
                'currentBidderId' => self::optionalId($data, 'currentBidderId'),
                'currentBidderName' => self::optionalText($data, 'currentBidderName', 100),
                'lastBidAt' => self::date($data, 'lastBidAt'), 'revision' => self::number($data, 'revision', 1),
                'updatedAt' => self::date($data, 'updatedAt'),
            ];
        }

        return $out;
    }

    /** @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, totalPages: int} */
    public static function bidPage(mixed $data, array $query): array
    {
        if (! is_array($data) || ! is_array($data['items'] ?? null) || ! array_is_list($data['items'])
            || count($data['items']) > $query['limit']
            || ! is_int($data['total'] ?? null) || ! is_int($data['page'] ?? null)
            || ! is_int($data['limit'] ?? null) || ! is_int($data['totalPages'] ?? null)
            || $data['total'] < 0 || $data['page'] !== $query['page'] || $data['limit'] !== $query['limit']
            || $data['totalPages'] !== (int) ceil($data['total'] / $data['limit'])) {
            throw new BackofficeUnavailable;
        }

        return [
            'items' => array_map(self::bid(...), $data['items']), 'total' => $data['total'],
            'page' => $data['page'], 'limit' => $data['limit'], 'totalPages' => $data['totalPages'],
        ];
    }

    /** @return array<string, mixed> */
    public static function settlement(mixed $data): array
    {
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['order' => self::settlementOrder(self::requiredNullable($data, 'order')),
            'payment' => self::settlementPayment(self::requiredNullable($data, 'payment'))];
    }

    /** @return array<string, mixed> */
    public static function health(array $data): array
    {
        if (($data['status'] ?? null) !== 'ok' && ($data['status'] ?? null) !== 'degraded') {
            throw new BackofficeUnavailable;
        }
        if (($data['api'] ?? null) !== 'up') {
            throw new BackofficeUnavailable;
        }
        foreach (['mongodb', 'redis', 'storage'] as $dependency) {
            if (! in_array($data[$dependency] ?? null, ['up', 'down'], true)) {
                throw new BackofficeUnavailable;
            }
            self::number($data, $dependency.'LatencyMs', 0, 2500);
        }

        return $data;
    }

    /** @return array<string, mixed> */
    private static function product(array $data): array
    {
        return [
            'name' => self::text($data, 'name', 120), 'description' => self::text($data, 'description', 2000),
            'category' => self::choice($data, 'category', self::CATEGORIES),
            'productionMethod' => self::choice($data, 'productionMethod', self::METHODS),
            'seasons' => self::enumList($data, 'seasons', self::SEASONS), 'unit' => self::choice($data, 'unit', self::UNITS),
        ];
    }

    /** @return array<string, mixed> */
    private static function owner(mixed $data): array
    {
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['id' => self::id($data, 'id'), 'name' => self::optionalText($data, 'name', 120),
            'email' => self::optionalText($data, 'email', 254), 'role' => self::optionalChoice($data, 'role', self::ROLES)];
    }

    /** @return array<string, mixed>|null */
    private static function payment(mixed $data): ?array
    {
        if ($data === null) {
            return null;
        }
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['id' => self::id($data, 'id'), 'status' => self::choice($data, 'status', self::PAYMENT_STATES),
            'amountCents' => self::number($data, 'amountCents', 0), 'checkoutId' => self::optionalId($data, 'checkoutId'),
            'auctionId' => self::optionalId($data, 'auctionId')];
    }

    /** @return array<string, mixed> */
    private static function orderItem(mixed $data): array
    {
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['productId' => self::id($data, 'productId'), 'productName' => self::text($data, 'productName', 120),
            'productUnit' => self::choice($data, 'productUnit', self::UNITS), 'quantity' => self::number($data, 'quantity', 1),
            'unitPriceCents' => self::number($data, 'unitPriceCents', 0), 'lineTotalCents' => self::number($data, 'lineTotalCents', 0)];
    }

    /** @return array<string, mixed> */
    private static function history(mixed $data): array
    {
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['status' => self::choice($data, 'status', self::ORDER_STATES), 'timestamp' => self::date($data, 'timestamp'),
            'actorId' => self::id($data, 'actorId'), 'actorRole' => self::choice($data, 'actorRole', self::ROLES),
            'note' => self::optionalText($data, 'note', 500)];
    }

    private static function refundAllocation(mixed $data): ?array
    {
        if ($data === null) {
            return null;
        }
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['paymentId' => self::id($data, 'paymentId'), 'refundedAt' => self::date($data, 'refundedAt')];
    }

    private static function refundRequest(mixed $data): ?array
    {
        if ($data === null) {
            return null;
        }
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['status' => self::choice($data, 'status', self::REFUND_STATES), 'requestedBy' => self::id($data, 'requestedBy'),
            'requestedAt' => self::date($data, 'requestedAt'), 'reason' => self::optionalText($data, 'reason', 500),
            'decidedBy' => self::optionalId($data, 'decidedBy'), 'decidedAt' => self::date($data, 'decidedAt'),
            'refundedCents' => self::optionalNumber($data, 'refundedCents', 0)];
    }

    private static function auctionProducer(mixed $data): array
    {
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['id' => self::id($data, 'id'), 'name' => self::optionalText($data, 'name', 120),
            'email' => self::optionalText($data, 'email', 254), 'role' => self::optionalChoice($data, 'role', self::ROLES),
            'status' => self::optionalChoice($data, 'status', self::PRODUCER_STATES)];
    }

    private static function bid(mixed $data): array
    {
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['id' => self::id($data, 'id'), 'buyerId' => self::id($data, 'buyerId'),
            'bidderName' => self::text($data, 'bidderName', 100), 'amountCents' => self::number($data, 'amountCents', 1),
            'acceptedAt' => self::requiredDate($data, 'acceptedAt'), 'endsAt' => self::requiredDate($data, 'endsAt'),
            'revision' => self::number($data, 'revision', 1)];
    }

    private static function settlementOrder(mixed $data): ?array
    {
        if ($data === null) {
            return null;
        }
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['id' => self::id($data, 'id'), 'status' => self::choice($data, 'status', self::ORDER_STATES),
            'totalCents' => self::number($data, 'totalCents', 0), 'paymentId' => self::id($data, 'paymentId'),
            'buyerId' => self::id($data, 'buyerId'), 'producerId' => self::id($data, 'producerId'), 'createdAt' => self::date($data, 'createdAt')];
    }

    private static function settlementPayment(mixed $data): ?array
    {
        if ($data === null) {
            return null;
        }
        if (! is_array($data)) {
            throw new BackofficeUnavailable;
        }

        return ['id' => self::id($data, 'id'), 'status' => self::choice($data, 'status', self::PAYMENT_STATES),
            'amountCents' => self::number($data, 'amountCents', 0), 'refundedCents' => self::number($data, 'refundedCents', 0),
            'buyerId' => self::id($data, 'buyerId'), 'createdAt' => self::date($data, 'createdAt')];
    }

    private static function list(array $data, string $key): array
    {
        if (! is_array($data[$key] ?? null) || count($data[$key]) > 500) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function requiredNullable(array $data, string $key): mixed
    {
        if (! array_key_exists($key, $data)) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function text(array $data, string $key, int $max): string
    {
        if (! is_string($data[$key] ?? null) || $data[$key] === '' || mb_strlen($data[$key]) > $max) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function optionalText(array $data, string $key, int $max): ?string
    {
        if (! array_key_exists($key, $data) || ($data[$key] !== null && (! is_string($data[$key]) || mb_strlen($data[$key]) > $max))) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function id(array $data, string $key): string
    {
        $value = self::text($data, $key, 24);
        if (preg_match(self::ID, $value) !== 1) {
            throw new BackofficeUnavailable;
        }

        return $value;
    }

    private static function optionalId(array $data, string $key): ?string
    {
        $value = self::optionalText($data, $key, 24);
        if ($value !== null && preg_match(self::ID, $value) !== 1) {
            throw new BackofficeUnavailable;
        }

        return $value;
    }

    private static function choice(array $data, string $key, array $allowed): string
    {
        $value = self::text($data, $key, 40);
        if (! in_array($value, $allowed, true)) {
            throw new BackofficeUnavailable;
        }

        return $value;
    }

    private static function optionalChoice(array $data, string $key, array $allowed): ?string
    {
        $value = self::optionalText($data, $key, 40);
        if ($value !== null && ! in_array($value, $allowed, true)) {
            throw new BackofficeUnavailable;
        }

        return $value;
    }

    private static function enumList(array $data, string $key, array $allowed): array
    {
        if (! is_array($data[$key] ?? null) || count($data[$key]) > 5) {
            throw new BackofficeUnavailable;
        }
        foreach ($data[$key] as $value) {
            if (! is_string($value) || ! in_array($value, $allowed, true)) {
                throw new BackofficeUnavailable;
            }
        }

        return $data[$key];
    }

    private static function number(array $data, string $key, int $min, int $max = PHP_INT_MAX): int
    {
        if (! is_int($data[$key] ?? null) || $data[$key] < $min || $data[$key] > $max) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function optionalNumber(array $data, string $key, int $min): ?int
    {
        if (! array_key_exists($key, $data) || ($data[$key] !== null && (! is_int($data[$key]) || $data[$key] < $min))) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function date(array $data, string $key): ?string
    {
        if (! array_key_exists($key, $data) || ($data[$key] !== null && (! is_string($data[$key]) || strtotime($data[$key]) === false))) {
            throw new BackofficeUnavailable;
        }

        return $data[$key];
    }

    private static function requiredDate(array $data, string $key): string
    {
        $value = self::date($data, $key);
        if ($value === null) {
            throw new BackofficeUnavailable;
        }

        return $value;
    }
}
