from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict, Field

from app.models.employee import EmploymentStatus


class DepartmentCreate(BaseModel):
    name: str


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class EmployeeCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=8)
    phone: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    manager_id: Optional[int] = None
    joining_date: Optional[date] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    manager_id: Optional[int] = None
    employment_status: Optional[EmploymentStatus] = None


class EmployeeSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(default=None, min_length=8)


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    phone: Optional[str]
    department_id: Optional[int]
    designation: Optional[str]
    manager_id: Optional[int]
    joining_date: Optional[date]
    employment_status: EmploymentStatus
