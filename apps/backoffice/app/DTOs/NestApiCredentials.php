<?php

declare(strict_types=1);

namespace App\DTOs;

final readonly class NestApiCredentials
{
    public function __construct(
        public string $accessToken,
        public string $refreshCookie,
        public int $expiresAt,
    ) {}

    /** @return array{access_token: string, refresh_cookie: string, expires_at: int} */
    public function toSession(): array
    {
        return [
            'access_token' => $this->accessToken,
            'refresh_cookie' => $this->refreshCookie,
            'expires_at' => $this->expiresAt,
        ];
    }
}
