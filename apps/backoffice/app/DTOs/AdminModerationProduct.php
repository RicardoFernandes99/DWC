<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Exceptions\BackofficeUnavailable;

final readonly class AdminModerationProduct
{
    private function __construct(
        public string $id,
        public string $name,
        public string $category,
        public int $priceCents,
        public string $unit,
        public string $producerId,
        public string $producerName,
        public bool $published,
        public ?string $archivedAt,
        public ?array $moderation,
        public int $revision,
        public string $createdAt,
        public ?string $description = null,
        public ?int $availableStock = null,
        public ?int $reservedStock = null,
        public ?string $imageUrl = null,
    ) {}

    public static function fromApi(mixed $payload, bool $detail = false): self
    {
        if (! is_array($payload)
            || ! is_string($payload['id'] ?? null)
            || ! is_string($payload['name'] ?? null)
            || ! is_string($payload['category'] ?? null)
            || ! is_int($payload['priceCents'] ?? null)
            || ! is_string($payload['unit'] ?? null)
            || ! is_string($payload['producerId'] ?? null)
            || ! is_string($payload['producerName'] ?? null)
            || ! is_bool($payload['published'] ?? null)
            || ! array_key_exists('archivedAt', $payload)
            || ! array_key_exists('moderation', $payload)
            || ! is_int($payload['revision'] ?? null)
            || ! is_string($payload['createdAt'] ?? null)) {
            throw new BackofficeUnavailable;
        }

        $archivedAt = $payload['archivedAt'];
        $moderation = $payload['moderation'];
        if (preg_match('/\A[a-f\d]{24}\z/i', $payload['id']) !== 1
            || preg_match('/\A[a-f\d]{24}\z/i', $payload['producerId']) !== 1
            || mb_strlen($payload['name']) < 1 || mb_strlen($payload['name']) > 120
            || mb_strlen($payload['producerName']) > 120
            || ! in_array($payload['category'], ['vegetables', 'fruits', 'dairy', 'eggs', 'meat', 'bakery', 'pantry', 'beverages', 'other'], true)
            || ! in_array($payload['unit'], ['unit', 'bunch', 'box', 'jar', 'bottle', 'bag', 'kg', 'g_500', 'g_250', 'l', 'ml_500'], true)
            || $payload['priceCents'] < 1 || $payload['priceCents'] > 10_000_000
            || $payload['revision'] < 1 || strtotime($payload['createdAt']) === false
            || ! (is_string($archivedAt) || $archivedAt === null)
            || ($archivedAt !== null && strtotime($archivedAt) === false)
            || ! self::validModeration($moderation)) {
            throw new BackofficeUnavailable;
        }

        $description = null;
        $availableStock = null;
        $reservedStock = null;
        $imageUrl = null;
        if ($detail) {
            if (! is_string($payload['description'] ?? null)
                || mb_strlen($payload['description']) > 2000
                || ! is_int($payload['availableStock'] ?? null)
                || ! is_int($payload['reservedStock'] ?? null)
                || ! array_key_exists('imageUrl', $payload)
                || $payload['availableStock'] < 0 || $payload['availableStock'] > 1_000_000
                || $payload['reservedStock'] < 0 || $payload['reservedStock'] > 1_000_000
                || ! (is_string($payload['imageUrl'] ?? null) || $payload['imageUrl'] === null)) {
                throw new BackofficeUnavailable;
            }
            $description = $payload['description'];
            $availableStock = $payload['availableStock'];
            $reservedStock = $payload['reservedStock'];
            $imageUrl = $payload['imageUrl'];
            if ($imageUrl !== null && (strlen($imageUrl) > 4096 || filter_var($imageUrl, FILTER_VALIDATE_URL) === false)) {
                throw new BackofficeUnavailable;
            }
            if ($imageUrl !== null && ! in_array(parse_url($imageUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
                throw new BackofficeUnavailable;
            }
        }

        return new self(
            $payload['id'], $payload['name'], $payload['category'], $payload['priceCents'], $payload['unit'],
            $payload['producerId'], $payload['producerName'], $payload['published'], $archivedAt, $moderation,
            $payload['revision'], $payload['createdAt'], $description, $availableStock, $reservedStock, $imageUrl,
        );
    }

    private static function validModeration(mixed $moderation): bool
    {
        if ($moderation === null) {
            return true;
        }
        if (! is_array($moderation) || ! is_string($moderation['hiddenAt'] ?? null)
            || ! array_key_exists('reason', $moderation) || ! array_key_exists('hiddenBy', $moderation)
            || strtotime($moderation['hiddenAt']) === false
            || ! (is_string($moderation['reason']) || $moderation['reason'] === null)
            || ! (is_string($moderation['hiddenBy']) || $moderation['hiddenBy'] === null)) {
            return false;
        }

        return $moderation['reason'] === null || mb_strlen($moderation['reason']) <= 500;
    }
}
