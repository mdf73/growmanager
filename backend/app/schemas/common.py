"""Schemas Pydantic communs"""
from pydantic import BaseModel
from typing import Optional, Generic, TypeVar


T = TypeVar('T')


class BaseResponse(BaseModel):
    """Réponse de base API"""
    success: bool
    message: str
    data: Optional[dict] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Réponse paginée"""
    total: int
    page: int
    page_size: int
    items: list[T]
