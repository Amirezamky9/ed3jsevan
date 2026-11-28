# Eyvan digital menu — single container for Gerdoo (frontend + PHP API).
FROM oven/bun:1 AS build
WORKDIR /build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_EYVAN_API_BASE=https://eyvandining.ir/api
ENV VITE_EYVAN_API_BASE=$VITE_EYVAN_API_BASE
RUN bun run build

FROM php:8.3-apache
RUN apt-get update && apt-get install -y libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite \
    && a2enmod rewrite headers deflate expires \
    && rm -rf /var/lib/apt/lists/*
RUN printf '<IfModule mpm_prefork_module>\n  StartServers 2\n  MinSpareServers 2\n  MaxSpareServers 4\n  MaxRequestWorkers 20\n  MaxConnectionsPerChild 1000\n</IfModule>\n' > /etc/apache2/mods-available/mpm_prefork.conf
RUN printf 'upload_max_filesize = 8M\npost_max_size = 16M\n' > /usr/local/etc/php/conf.d/uploads.ini
RUN printf 'Alias /uploads /data/uploads\n<Directory /data/uploads>\n  Require all granted\n</Directory>\n' > /etc/apache2/conf-available/eyvan-uploads.conf \
    && a2enconf eyvan-uploads
COPY backend/src /app/src
COPY backend/seed /app/seed
COPY backend/setup.php /app/setup.php
COPY --from=build /build/dist /var/www/html
COPY backend/public/api/index.php /var/www/html/api/index.php
COPY backend/public/api/.htaccess /var/www/html/api/.htaccess
COPY gerdoo-config.php /var/www/html/api/config.php
RUN mkdir -p /data/uploads && chown -R www-data:www-data /data \
    && chmod -R a+rX /var/www/html /app \
    && sed -i '/RewriteCond %{HTTPS} off/d; /https:\/\/%{HTTP_HOST}/d' /var/www/html/.htaccess
EXPOSE 80
