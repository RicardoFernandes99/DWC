<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Exceptions\BackofficeUnavailable;

final readonly class AdminReportedReview
{
    /** @param array<string, int> $categoryCounts */
    private function __construct(
        public string $reviewId,
        public int $rating,
        public ?string $comment,
        public string $visibility,
        public ?array $moderation,
        public int $revision,
        public string $reviewCreatedAt,
        public array $author,
        public array $producer,
        public string $orderId,
        public int $reportCount,
        public ?string $latestReportAt,
        public array $categoryCounts,
        public array $reports = [],
    ) {}

    public static function fromApi(mixed $payload, bool $detail = false): self
    {
        if (! is_array($payload)
            || ! is_string($payload['reviewId'] ?? null)
            || ! is_int($payload['rating'] ?? null)
            || ! array_key_exists('comment', $payload)
            || ! is_string($payload['visibility'] ?? null)
            || ! array_key_exists('moderation', $payload)
            || ! is_int($payload['revision'] ?? null)
            || ! is_string($payload['reviewCreatedAt'] ?? null)
            || ! is_array($payload['author'] ?? null)
            || ! is_array($payload['producer'] ?? null)
            || ! is_string($payload['orderId'] ?? null)
            || ! is_int($payload['reportCount'] ?? null)
            || ! array_key_exists('latestReportAt', $payload)
            || ! is_array($payload['categoryCounts'] ?? null)) {
            throw new BackofficeUnavailable;
        }

        $comment = $payload['comment'];
        $latest = $payload['latestReportAt'];
        if (preg_match('/\A[a-f\d]{24}\z/i', $payload['reviewId']) !== 1
            || preg_match('/\A[a-f\d]{24}\z/i', $payload['orderId']) !== 1
            || $payload['rating'] < 1 || $payload['rating'] > 5
            || ! (is_string($comment) || $comment === null)
            || ($comment !== null && mb_strlen($comment) > 1000)
            || ! in_array($payload['visibility'], ['visible', 'hidden'], true)
            || ! self::validModeration($payload['moderation'])
            || $payload['revision'] < 1 || strtotime($payload['reviewCreatedAt']) === false
            || ! self::validPerson($payload['author']) || ! self::validProducer($payload['producer'])
            || $payload['reportCount'] < 0 || ! (is_string($latest) || $latest === null)
            || ($latest !== null && strtotime($latest) === false)) {
            throw new BackofficeUnavailable;
        }

        $counts = [];
        foreach ($payload['categoryCounts'] as $category => $count) {
            if (! in_array($category, ['spam', 'offensive', 'off_topic', 'false_information', 'other'], true)
                || ! is_int($count) || $count < 0) {
                throw new BackofficeUnavailable;
            }
            $counts[$category] = $count;
        }

        $reports = [];
        if ($detail) {
            if (! is_array($payload['reports'] ?? null) || count($payload['reports']) > 100) {
                throw new BackofficeUnavailable;
            }
            foreach ($payload['reports'] as $report) {
                $reports[] = self::parseReport($report);
            }
        }

        return new self(
            $payload['reviewId'], $payload['rating'], $comment, $payload['visibility'], $payload['moderation'],
            $payload['revision'], $payload['reviewCreatedAt'], $payload['author'], $payload['producer'],
            $payload['orderId'], $payload['reportCount'], $latest, $counts, $reports,
        );
    }

    private static function validPerson(array $person): bool
    {
        return is_string($person['id'] ?? null) && preg_match('/\A[a-f\d]{24}\z/i', $person['id']) === 1
            && is_string($person['name'] ?? null) && mb_strlen($person['name']) <= 100;
    }

    private static function validProducer(array $producer): bool
    {
        return is_string($producer['id'] ?? null) && preg_match('/\A[a-f\d]{24}\z/i', $producer['id']) === 1
            && is_string($producer['farmName'] ?? null) && mb_strlen($producer['farmName']) <= 120;
    }

    private static function validModeration(mixed $moderation): bool
    {
        if ($moderation === null) {
            return true;
        }

        return is_array($moderation) && is_string($moderation['hiddenAt'] ?? null)
            && strtotime($moderation['hiddenAt']) !== false
            && array_key_exists('reason', $moderation) && (is_string($moderation['reason']) || $moderation['reason'] === null)
            && array_key_exists('hiddenBy', $moderation) && (is_string($moderation['hiddenBy']) || $moderation['hiddenBy'] === null)
            && ($moderation['reason'] === null || mb_strlen($moderation['reason']) <= 500);
    }

    private static function parseReport(mixed $report): array
    {
        if (! is_array($report) || ! is_string($report['id'] ?? null)
            || preg_match('/\A[a-f\d]{24}\z/i', $report['id']) !== 1
            || ! in_array($report['category'] ?? null, ['spam', 'offensive', 'off_topic', 'false_information', 'other'], true)
            || ! array_key_exists('note', $report) || ! (is_string($report['note']) || $report['note'] === null)
            || ($report['note'] !== null && mb_strlen($report['note']) > 500)
            || ! is_string($report['createdAt'] ?? null) || strtotime($report['createdAt']) === false
            || ! is_array($report['reporter'] ?? null) || ! self::validPerson($report['reporter'])) {
            throw new BackofficeUnavailable;
        }

        return $report;
    }
}
