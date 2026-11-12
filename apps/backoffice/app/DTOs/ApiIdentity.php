<?php

declare(strict_types=1);

namespace App\DTOs;

use UnexpectedValueException;

final readonly class ApiIdentity
{
    private function __construct(
        public string $id,
        public string $name,
        public string $email,
        public string $role,
    ) {}

    /** @param array<string, mixed> $user */
    public static function fromApi(array $user): self
    {
        $id = $user['id'] ?? null;
        $name = $user['name'] ?? null;
        $email = $user['email'] ?? null;
        $role = $user['role'] ?? null;

        if (! is_string($id) || ! preg_match('/^[a-f0-9]{24}$/i', $id)
            || ! is_string($name) || $name === '' || mb_strlen($name) > 100
            || ! is_string($email) || mb_strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false
            || ! is_string($role) || ! in_array($role, ['admin', 'buyer', 'producer'], true)) {
            throw new UnexpectedValueException('The API returned an invalid identity.');
        }

        return new self($id, $name, $email, $role);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
