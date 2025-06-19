from sqlalchemy import Column, Integer, String, Float
from .database import Base

class ShippingRate(Base):
    __tablename__ = "shipping_rates"
    id = Column(Integer, primary_key=True, index=True)
    country = Column(String, index=True)
    weight = Column(Float, index=True)
    type = Column(String, index=True)  # 'docs' or 'non-docs'
    original_rate = Column(Float)
    discount_rate = Column(String)  # Can be "No discount available" or a float as string 