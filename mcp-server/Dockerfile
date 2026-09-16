# Image du serveur MCP GrowManager (mode réseau, "Streamable HTTP").
# Ce Dockerfile est destiné au déploiement en conteneur (docker-compose.prod.yml) ;
# l'installation Windows locale (stdio, Claude Desktop) n'en a pas besoin.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

ENV GROWMANAGER_MCP_TRANSPORT=http \
    GROWMANAGER_MCP_HTTP_HOST=0.0.0.0 \
    GROWMANAGER_MCP_HTTP_PORT=8100

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/healthz', timeout=3)" || exit 1

CMD ["python", "server.py"]
