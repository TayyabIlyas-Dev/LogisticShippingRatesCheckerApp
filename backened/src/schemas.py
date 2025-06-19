from pydantic import BaseModel

class ShippingRateBase(BaseModel):
    country: str
    weight: float
    type: str
    original_rate: float
    discount_rate: str

class ShippingRateCreate(ShippingRateBase):
    pass

class ShippingRateOut(ShippingRateBase):
    id: int
    class Config:
        orm_mode = True 