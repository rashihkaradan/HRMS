from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.user import RoleEnum


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: RoleEnum = RoleEnum.EMPLOYEE


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: RoleEnum
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
