from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-3.8-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_TRANSCRIPTION_MODEL: str = "gemini-3.5-transcribe"
    GEMINI_TRANSCRIPTION_FALLBACK_MODEL: str = "gemini-3.5-flash-lite"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    POLICY_DOCUMENTS_DIR: str = "./documents"
    CHROMA_COLLECTION: str = "hr_documents_gemini"
    CHROMA_CANDIDATE_COLLECTION: str = "hr_candidate_profiles_gemini"

    class Config:
        env_file = ".env"


settings = Settings()
