FROM php:8.3-cli
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev libxml2-dev libzip-dev libsqlite3-dev unzip git \
    && docker-php-ext-install pdo_mysql pdo_sqlite mbstring dom xml xmlwriter zip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
