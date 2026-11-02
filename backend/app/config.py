from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_token: str = "change-me-to-a-long-random-token"
    database_url: str = (
        "postgresql+psycopg://amp:amp_dev_password@localhost:5433/agent_platform"
    )
    cors_origins: str = "*"
    agents_data_dir: str = "/data/agents"

    # LLM (LiteLLM)
    default_llm_provider: str = "ollama"
    default_llm_model: str = "llama3"
    llm_api_base: str = "http://ollama:11434"

    # Execution engine
    execution_mode: str = "local"
    """local | docker — docker isolates each run in a container."""
    docker_network: str = "agent-management-platform_amp"
    default_agent_image: str = "python:3.12-slim"
    docker_socket: str = "unix:///var/run/docker.sock"


@lru_cache
def get_settings() -> Settings:
    return Settings()
