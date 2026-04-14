# Python WS Server — Ransom DB encryption + Reverse Proxy
# Porta 4445 (management) + 4444 (agent)
FROM python:3.12-slim

WORKDIR /app

COPY src-p/ /app/src-p/
COPY src-p/requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r requirements.txt pymongo redis firebase-admin aiohttp

RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/logs && chown -R appuser:appuser /app

ENV PYTHONPATH=/app/src-p
ENV PYTHONUNBUFFERED=1

USER appuser

EXPOSE 4445 4444

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import socket; s=socket.create_connection(('localhost',4445),2); s.close()" || exit 1

CMD ["python", "src-p/main.py"]
