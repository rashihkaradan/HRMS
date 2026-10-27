from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_roles, get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.user import User, RoleEnum
from app.models.employee import Employee, Department
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeSelfUpdate,
    EmployeeOut,
    DepartmentCreate,
    DepartmentOut,
)

router = APIRouter(prefix="/employees", tags=["employees"])
dept_router = APIRouter(prefix="/departments", tags=["departments"])

HR_ROLES = [RoleEnum.SUPER_ADMIN, RoleEnum.HR_ADMIN, RoleEnum.HR_MANAGER]


@dept_router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(HR_ROLES)),
):
    dept = Department(name=payload.name)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@dept_router.get("/", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Department))
    return result.scalars().all()


@router.post("/", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(HR_ROLES)),
):
    existing_employee = await db.execute(select(Employee).where(Employee.email == payload.email))
    if existing_employee.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee with this email already exists")

    existing_user = await db.execute(select(User).where(User.email == payload.email))
    user = existing_user.scalar_one_or_none()
    if user is None:
        if not payload.password:
            raise HTTPException(status_code=422, detail="Password is required when creating a new login account")
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            role=RoleEnum.EMPLOYEE,
        )
        db.add(user)
        await db.flush()

    employee_data = payload.model_dump(exclude={"password"})
    employee = Employee(user_id=user.id, **employee_data)
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


@router.get("/", response_model=list[EmployeeOut])
async def list_employees(
    department_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Employee)
    if department_id is not None:
        query = query.where(Employee.department_id == department_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/me", response_model=EmployeeOut)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the employee record linked to the current user."""
    result = await db.execute(
        select(Employee).where(Employee.user_id == current_user.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="No employee profile linked to this user")
    return employee


@router.patch("/me", response_model=EmployeeOut)
async def update_my_profile(
    payload: EmployeeSelfUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow an employee to update their own contact details and password."""
    result = await db.execute(select(Employee).where(Employee.user_id == current_user.id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="No employee profile linked to this user")

    if payload.new_password:
        if not payload.current_password or not verify_password(
            payload.current_password, current_user.hashed_password
        ):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.hashed_password = hash_password(payload.new_password)

    if payload.email and payload.email != current_user.email:
        user_match = await db.execute(select(User).where(User.email == payload.email))
        if user_match.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="A user with this email already exists")
        employee_match = await db.execute(select(Employee).where(Employee.email == payload.email))
        if employee_match.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Employee with this email already exists")
        current_user.email = payload.email
        employee.email = payload.email

    if payload.full_name is not None:
        current_user.full_name = payload.full_name
        employee.full_name = payload.full_name
    if payload.phone is not None:
        employee.phone = payload.phone

    await db.commit()
    await db.refresh(employee)
    return employee


@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(HR_ROLES)),
):
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles([RoleEnum.SUPER_ADMIN, RoleEnum.HR_ADMIN])),
):
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.delete(employee)
    await db.commit()
