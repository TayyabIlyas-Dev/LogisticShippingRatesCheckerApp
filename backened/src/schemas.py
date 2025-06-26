from typing import Optional
from pydantic import BaseModel

class ShippingRateBase(BaseModel):
    country: str
    weight: float
    type: str
    original_rate: float
    discount_rate: Optional[str] = None
    source: str
    student: Optional[bool] = False
    zone: Optional[str] = None

class ShippingRateCreate(ShippingRateBase):
    pass

class ShippingRateOut(ShippingRateBase):
    id: int

    class Config:
        orm_mode = True
