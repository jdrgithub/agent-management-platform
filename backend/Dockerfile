FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build context is the repository root.
COPY packages/agent-sdk /tmp/agent-sdk
COPY backend/requirements.txt /tmp/requirements.txt

RUN pip install --no-cache-dir /tmp/agent-sdk \
    && pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm -rf /tmp/agent-sdk

COPY backend/app ./app

RUN mkdir -p /data/agents

EXPOSE 8081

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
