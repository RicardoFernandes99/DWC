<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Exceptions\BackofficeUnavailable;

final readonly class AdminProducerApplication
{
    /** @param array{farmName: string, description: string, city: string, collectionAddress: string, latitude: float|int, longitude: float|int} $application */
    private function __construct(
        public string $id,
        public string $name,
        public string $email,
        public ProducerApplicationStatus $status,
        public int $revision,
        public ?string $rejectionReason,
        public ?string $suspensionReason,
        public string $submittedAt,
        public ?string $decidedAt,
        public array $application,
    ) {}

    public static function fromApi(mixed $payload): self
    {
        if (! is_array($payload) || ! array_key_exists('rejectionReason', $payload)
            || ! array_key_exists('suspensionReason', $payload) || ! array_key_exists('decidedAt', $payload)
            || ! is_string($payload['id'] ?? null)
            || ! is_string($payload['name'] ?? null) || ! is_string($payload['email'] ?? null)
            || ! is_string($payload['status'] ?? null) || ! is_int($payload['revision'] ?? null)
            || ! is_string($payload['submittedAt'] ?? null)
            || ! (is_string($payload['rejectionReason']) || $payload['rejectionReason'] === null)
            || ! (is_string($payload['suspensionReason']) || $payload['suspensionReason'] === null)
            || ! (is_string($payload['decidedAt']) || $payload['decidedAt'] === null)) {
            throw new BackofficeUnavailable;
        }

        $status = ProducerApplicationStatus::tryFrom($payload['status']);
        $application = $payload['application'] ?? null;
        if ($status === null || ! is_array($application)
            || preg_match('/\A[a-f\d]{24}\z/i', $payload['id']) !== 1
            || strlen($payload['name']) > 200 || strlen($payload['email']) > 254
            || $payload['revision'] < 1 || strtotime($payload['submittedAt']) === false
            || ($payload['decidedAt'] !== null && strtotime($payload['decidedAt']) === false)
            || ! is_string($application['farmName'] ?? null)
            || ! is_string($application['description'] ?? null)
            || ! is_string($application['city'] ?? null)
            || ! is_string($application['collectionAddress'] ?? null)
            || ! (is_float($application['latitude'] ?? null) || is_int($application['latitude'] ?? null))
            || ! (is_float($application['longitude'] ?? null) || is_int($application['longitude'] ?? null))
            || $application['latitude'] < -90 || $application['latitude'] > 90
            || $application['longitude'] < -180 || $application['longitude'] > 180) {
            throw new BackofficeUnavailable;
        }

        return new self(
            $payload['id'], $payload['name'], $payload['email'], $status, $payload['revision'],
            $payload['rejectionReason'], $payload['suspensionReason'], $payload['submittedAt'],
            $payload['decidedAt'], [
                'farmName' => $application['farmName'],
                'description' => $application['description'],
                'city' => $application['city'],
                'collectionAddress' => $application['collectionAddress'],
                'latitude' => $application['latitude'],
                'longitude' => $application['longitude'],
            ],
        );
    }
}
