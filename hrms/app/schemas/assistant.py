from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    sources: list[str]


class IngestResponse(BaseModel):
    filename: str
    chunks_ingested: int
    saved_as: str


class CandidateSearchRequest(BaseModel):
    job_id: int
    question: str = Field(default="Find the applicants whose submitted evidence best aligns with this role.", max_length=1000)
