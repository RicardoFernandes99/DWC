# Local development image: Laravel Octane on FrankenPHP keeps the app in memory,
# so a request does not re-read the project from the (slow) Windows bind mount.
FROM dunglas/frankenphp:1-php8.4-bookworm

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN install-php-extensions pcntl mbstring opcache zip

WORKDIR /var/www/html
EXPOSE 8080
CMD ["sh", "docker/dev.sh"]
