<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\AdminModerationProduct;
use App\DTOs\AdminReportedReview;
use App\DTOs\ModerationState;
use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\ProducerApiFailure;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

final class NestModerationService
{
    /** @return array{items: list<AdminModerationProduct>, total: int, page: int, limit: int} */
    public function products(array $credentials, int $page, ModerationState $state): array
    {
        $body = $this->payload($this->request($credentials)->get($this->url('admin/products'), [
            'page' => $page, 'limit' => 20, 'state' => $state->value,
        ]));
        if (! is_array($body) || ! is_array($body['items'] ?? null) || count($body['items']) > 20
            || ! is_int($body['total'] ?? null) || ! is_int($body['page'] ?? null) || ! is_int($body['limit'] ?? null)
            || $body['total'] < 0 || $body['page'] !== $page || $body['limit'] !== 20) {
            throw new BackofficeUnavailable;
        }

        return [
            'items' => array_map(AdminModerationProduct::fromApi(...), $body['items']),
            'total' => $body['total'], 'page' => $body['page'], 'limit' => $body['limit'],
        ];
    }

    public function product(array $credentials, string $id): AdminModerationProduct
    {
        return AdminModerationProduct::fromApi(
            $this->payload($this->request($credentials)->get($this->url('admin/products/'.$id))), true,
        );
    }

    /** @return array{items: list<AdminReportedReview>, total: int, page: int, limit: int} */
    public function reviews(array $credentials, int $page, ModerationState $state): array
    {
        $body = $this->payload($this->request($credentials)->get($this->url('admin/review-reports'), [
            'page' => $page, 'limit' => 20, 'state' => $state->value,
        ]));
        if (! is_array($body) || ! is_array($body['items'] ?? null) || count($body['items']) > 20
            || ! is_int($body['total'] ?? null) || ! is_int($body['page'] ?? null) || ! is_int($body['limit'] ?? null)
            || $body['total'] < 0 || $body['page'] !== $page || $body['limit'] !== 20) {
            throw new BackofficeUnavailable;
        }

        return [
            'items' => array_map(AdminReportedReview::fromApi(...), $body['items']),
            'total' => $body['total'], 'page' => $body['page'], 'limit' => $body['limit'],
        ];
    }

    public function review(array $credentials, string $id): AdminReportedReview
    {
        return AdminReportedReview::fromApi(
            $this->payload($this->request($credentials)->get($this->url('admin/reviews/'.$id))), true,
        );
    }

    /** @param array{revision: int, reason: string} $input */
    public function hide(array $credentials, string $kind, string $id, array $input): AdminModerationProduct|AdminReportedReview
    {
        $path = $kind === 'product' ? 'admin/products/' : 'admin/reviews/';
        $body = $this->payload($this->request($credentials)->post($this->url($path.$id.'/hide'), $input));

        return $kind === 'product'
            ? AdminModerationProduct::fromApi($body, true)
            : AdminReportedReview::fromApi($body, true);
    }

    private function request(array $credentials): PendingRequest
    {
        $token = $credentials['access_token'] ?? null;
        if (! is_string($token) || $token === '' || strlen($token) > 4096) {
            throw new ApiSessionExpired;
        }

        return Http::acceptJson()->asJson()->withToken($token)
            ->withoutRedirecting()->connectTimeout(3)->timeout(5);
    }

    private function payload(Response $response): mixed
    {
        if ($response->status() === 401 || $response->status() === 403) {
            throw new ApiSessionExpired;
        }
        if (! $response->successful()) {
            $body = $response->json();
            $message = is_array($body) && is_string($body['message'] ?? null)
                ? trim(preg_replace('/[\x00-\x1F\x7F]/u', ' ', $body['message']) ?? '')
                : '';
            if (in_array($response->status(), [400, 404, 409], true) && $message !== '' && mb_strlen($message) <= 500) {
                throw new ProducerApiFailure($response->status(), $message);
            }
            if ($response->status() >= 500) {
                throw new BackofficeUnavailable;
            }
            throw new ProducerApiFailure($response->status(), 'The request could not be completed. Refresh the content and try again.');
        }
        $body = $response->json();
        if ($body === null) {
            throw new BackofficeUnavailable;
        }

        return $body;
    }

    private function url(string $path): string
    {
        return rtrim((string) config('services.nest.base_url'), '/').'/'.$path;
    }
}
