from sqlalchemy import Column, Integer, String, Float, Boolean
from .database import Base

class ShippingRate(Base):
    __tablename__ = "shipping_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    country = Column(String, index=True)
    weight = Column(Float, index=True)
    type = Column(String, index=True)  # 'docs', 'non-docs', 'zone'
    original_rate = Column(Float)
    discount_rate = Column(String, nullable=True)  # Can be null or string
    source = Column(String, index=True)            # File source: retail/docs/etc
    student = Column(Boolean, default=False)       # ✅ True only for student file
    zone = Column(String, nullable=True)           # ✅ e.g. '1', '2', ..., or None
