<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\AdminProducerApplication;
use App\DTOs\ProducerApplicationStatus;
use App\Exceptions\ApiSessionExpired;
use App\Exceptions\BackofficeUnavailable;
use App\Exceptions\ProducerApiFailure;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

final class NestProducerApplicationService
{
    /** @return array{items: list<AdminProducerApplication>, total: int, page: int, limit: int} */
    public function list(array $credentials, int $page, ?ProducerApplicationStatus $status): array
    {
        $query = [
            'page' => $page,
            'limit' => 20,
        ];
        if ($status !== null) {
            $query['status'] = $status->value;
        }
        $payload = $this->request($credentials)->get($this->url('admin/producer-applications'), $query);

        $body = $this->payload($payload);
        if (! is_array($body) || ! is_array($body['items'] ?? null)
            || ! is_int($body['total'] ?? null) || ! is_int($body['page'] ?? null)
            || ! is_int($body['limit'] ?? null) || count($body['items']) > 20
            || $body['total'] < 0 || $body['page'] !== $page || $body['limit'] !== 20) {
            throw new BackofficeUnavailable;
        }

        return [
            'items' => array_map(AdminProducerApplication::fromApi(...), $body['items']),
            'total' => $body['total'],
            'page' => $body['page'],
            'limit' => $body['limit'],
        ];
    }

    public function get(array $credentials, string $id): AdminProducerApplication
    {
        return AdminProducerApplication::fromApi($this->payload(
            $this->request($credentials)->get($this->url('admin/producer-applications/'.$id)),
        ));
    }

    /** @param array{revision: int, reason?: string} $input */
    public function decide(array $credentials, string $id, string $action, array $input): AdminProducerApplication
    {
        return AdminProducerApplication::fromApi($this->payload(
            $this->request($credentials)->post($this->url('admin/producer-applications/'.$id.'/'.$action), $input),
        ));
    }

    /** @param array{revision: int, reason?: string} $input */
    public function changeStanding(array $credentials, string $id, string $action, array $input): AdminProducerApplication
    {
        return AdminProducerApplication::fromApi($this->payload(
            $this->request($credentials)->post($this->url('admin/producers/'.$id.'/'.$action), $input),
        ));
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
            if (in_array($response->status(), [400, 404, 409], true) && $message !== '' && strlen($message) <= 500) {
                throw new ProducerApiFailure($response->status(), $message);
            }

            if ($response->status() >= 500) {
                throw new BackofficeUnavailable;
            }

            throw new ProducerApiFailure($response->status(), 'The request could not be completed. Refresh the page and try again.');
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
