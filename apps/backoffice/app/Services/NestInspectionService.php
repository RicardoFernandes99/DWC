<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\InspectionPayload;
use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\InspectionRecordNotFound;
use App\Exceptions\ProducerApiFailure;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

final class NestInspectionService
{
    /** @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, totalPages: int} */
    public function users(array $credentials, array $query): array
    {
        return $this->page($this->get($credentials, 'admin/users', $query), $query, InspectionPayload::user(...));
    }

    /** @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, totalPages: int} */
    public function orders(array $credentials, array $query): array
    {
        return $this->page($this->get($credentials, 'admin/orders', $query), $query, InspectionPayload::order(...));
    }

    /** @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, totalPages: int} */
    public function auctions(array $credentials, array $query): array
    {
        return $this->page($this->get($credentials, 'admin/auctions', $query), $query, InspectionPayload::auction(...));
    }

    public function user(array $credentials, string $id): array
    {
        return InspectionPayload::user($this->object($this->get($credentials, 'admin/users/'.$id, [], true)), true);
    }

    /** @param array{revision: int, reason?: string} $input @return array<string, mixed> */
    public function changeBuyerStanding(array $credentials, string $id, string $action, array $input): array
    {
        $token = $credentials['access_token'] ?? null;
        if (! is_string($token) || $token === '' || strlen($token) > 4096) {
            throw new ApiSessionExpired;
        }
        $response = $this->request($token)->post($this->url('admin/buyers/'.$id.'/'.$action), $input);
        if ($response->status() === 401 || $response->status() === 403) {
            throw new ApiSessionExpired;
        }
        if (! $response->successful()) {
            $body = $response->json();
            $message = is_array($body) && is_string($body['message'] ?? null)
                ? trim(preg_replace('/[\x00-\x1F\x7F]/u', ' ', $body['message']) ?? '')
                : '';
            if (in_array($response->status(), [400, 404, 409], true) && $message !== '' && strlen($message) <= 500) {
                throw new ProducerApiFailure($response->status(), $message);
            }
            throw new BackofficeUnavailable;
        }
        $payload = $response->json();
        if (! is_array($payload)) {
            throw new BackofficeUnavailable;
        }

        return InspectionPayload::buyerStanding($payload);
    }

    public function order(array $credentials, string $id): array
    {
        return InspectionPayload::order($this->object($this->get($credentials, 'admin/orders/'.$id, [], true)), true);
    }

    public function orderReceipt(array $credentials, string $id): string
    {
        $token = $credentials['access_token'] ?? null;
        if (! is_string($token) || $token === '' || strlen($token) > 4096) {
            throw new ApiSessionExpired;
        }
        $response = $this->request($token)->get($this->url('admin/orders/'.$id.'/receipt.pdf'));
        if ($response->status() === 401 || $response->status() === 403) {
            throw new ApiSessionExpired;
        }
        if ($response->status() === 404) {
            throw new InspectionRecordNotFound;
        }
        $pdf = $response->body();
        if (! $response->successful() || $pdf === '' || strlen($pdf) > 1_500_000
            || ! str_starts_with($pdf, '%PDF-')
            || ! str_contains(strtolower($response->header('Content-Type')), 'application/pdf')) {
            throw new BackofficeUnavailable;
        }

        return $pdf;
    }

    public function auction(array $credentials, string $id, array $query): array
    {
        $payload = $this->object($this->get($credentials, 'admin/auctions/'.$id, $query, true));
        $auction = InspectionPayload::auction($payload, true);
        $auction['bidHistory'] = InspectionPayload::bidPage($payload['bidHistory'] ?? null, $query);
        $auction['settlement'] = InspectionPayload::settlement($payload['settlement'] ?? null);

        return $auction;
    }

    /** @param callable(array<string, mixed>): array<string, mixed> $convert
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, totalPages: int}
     */
    private function page(mixed $payload, array $query, callable $convert): array
    {
        if (! is_array($payload) || ! is_array($payload['items'] ?? null) || ! array_is_list($payload['items'])
            || count($payload['items']) > $query['limit'] || ! is_int($payload['total'] ?? null)
            || ! is_int($payload['page'] ?? null) || ! is_int($payload['limit'] ?? null)
            || ! is_int($payload['totalPages'] ?? null) || $payload['total'] < 0
            || $payload['page'] !== $query['page'] || $payload['limit'] !== $query['limit']
            || $payload['totalPages'] !== (int) ceil($payload['total'] / $payload['limit'])) {
            throw new BackofficeUnavailable;
        }

        return [
            'items' => array_map(function (mixed $item) use ($convert): array {
                if (! is_array($item)) {
                    throw new BackofficeUnavailable;
                }

                return $convert($item);
            }, $payload['items']),
            'total' => $payload['total'], 'page' => $payload['page'],
            'limit' => $payload['limit'], 'totalPages' => $payload['totalPages'],
        ];
    }

    private function get(array $credentials, string $path, array $query = [], bool $missingIs404 = false): mixed
    {
        $token = $credentials['access_token'] ?? null;
        if (! is_string($token) || $token === '' || strlen($token) > 4096) {
            throw new ApiSessionExpired;
        }

        return $this->payload($this->request($token)->get($this->url($path), $query), $missingIs404);
    }

    private function request(string $token): PendingRequest
    {
        return Http::acceptJson()->asJson()->withToken($token)
            ->withoutRedirecting()->connectTimeout(3)->timeout(5);
    }

    private function payload(Response $response, bool $missingIs404): mixed
    {
        if ($response->status() === 401 || $response->status() === 403) {
            throw new ApiSessionExpired;
        }
        if ($response->status() === 404 && $missingIs404) {
            throw new InspectionRecordNotFound;
        }
        if (! $response->successful() || $response->json() === null) {
            throw new BackofficeUnavailable;
        }

        return $response->json();
    }

    /** @return array<string, mixed> */
    private function object(mixed $payload): array
    {
        if (! is_array($payload)) {
            throw new BackofficeUnavailable;
        }

        return $payload;
    }

    private function url(string $path): string
    {
        return rtrim((string) config('services.nest.base_url'), '/').'/'.$path;
    }
}
