FROM node:22-bookworm-slim AS web
WORKDIR /src/apps/web
COPY apps/web/package*.json ./
RUN npm ci --legacy-peer-deps
COPY apps/web ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PROMARKIA_NO_BROWSER=1
WORKDIR /app
RUN addgroup --system promarkia && adduser --system --ingroup promarkia promarkia \
    && apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml requirements.lock README.md LICENSE THIRD_PARTY_NOTICES.md ./
COPY THIRD_PARTY_LICENSES ./THIRD_PARTY_LICENSES
RUN pip install --no-cache-dir -r requirements.lock
COPY apps/api ./apps/api
COPY --from=web /src/apps/web/dist ./apps/api/autogenstudio/web/ui
RUN pip install --no-cache-dir --no-deps .
RUN mkdir -p /data && chown -R promarkia:promarkia /app /data
USER promarkia
ENV PROMARKIA_DATA_DIR=/data PROMARKIA_HOST=0.0.0.0 PROMARKIA_UNSAFE_ALLOW_NETWORK_BIND=1
EXPOSE 8788
CMD ["promarkia", "serve", "--port", "8788", "--no-browser"]
