# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Installe les dépendances dans un layer séparé.
# Objectif: image finale aussi petite que possible (modèles spaCy exclus du prod minimal).
FROM python:3.12-slim AS builder

# Sécurité: pas de root
RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid 1000 --no-create-home app

WORKDIR /build

# Installer les dépendances système pour la compilation (PyMuPDF, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements en premier pour bénéficier du cache Docker layer
COPY requirements.txt .

# Installation dans un répertoire dédié (facilite le copy dans le stage final)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Télécharger le modèle spaCy français
# Note: en production, ce modèle devrait être inclus dans le build ou
# chargé depuis un volume persistant pour accélérer le démarrage.
RUN /install/bin/python -m spacy download fr_core_news_lg --target /install/lib/python3.12/site-packages


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Sécurité: utilisateur non-root
RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid 1000 --create-home app

# Dépendances système runtime uniquement (pas de build-essential)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les dépendances installées depuis le builder
COPY --from=builder /install /usr/local

# Copier le code source
COPY --chown=app:app app/ ./app/

# Variables d'environnement (non-sensibles, peuvent être dans le Dockerfile)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    # Désactiver les telemetries des librairies
    ANONYMIZED_TELEMETRY=false \
    SCARF_NO_ANALYTICS=true

# Passer en utilisateur non-root
USER app

# Health check intégré (utilisé par Docker Compose et Kubernetes)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Port exposé (documentation uniquement, le binding se fait dans docker-compose)
EXPOSE 8000

# Démarrage: Uvicorn avec workers multiples
# En production: remplacer par gunicorn avec uvicorn workers pour le préchargement
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--log-level", "info", \
     "--access-log"]
