FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ICAN_ENVIRONMENT=production \
    ICAN_DATABASE_URL=sqlite:////data/ican.db \
    ICAN_UPLOAD_DIR=/data/uploads \
    ICAN_LOG_DIR=/data/logs \
    ICAN_EXPOSE_RESET_TOKEN=false

WORKDIR /app
COPY services/api/requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY services/api/app ./app
COPY services/api/alembic.ini ./alembic.ini
COPY services/api/alembic ./alembic
RUN mkdir -p /data/uploads /data/logs

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
