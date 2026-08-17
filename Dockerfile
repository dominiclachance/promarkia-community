FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN addgroup --system promarkia && adduser --system --ingroup promarkia promarkia
COPY pyproject.toml README.md LICENSE ./
COPY app ./app
RUN pip install --no-cache-dir .
RUN mkdir -p /data && chown -R promarkia:promarkia /app /data
USER promarkia
ENV PROMARKIA_DATA_DIR=/data PROMARKIA_HOST=0.0.0.0 PROMARKIA_PORT=8788
EXPOSE 8788
CMD ["promarkia", "serve"]
