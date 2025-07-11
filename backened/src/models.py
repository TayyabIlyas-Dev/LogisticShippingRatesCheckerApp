from sqlalchemy import Column, Integer, String, Float, Boolean
from .database import Base

class ShippingRate(Base):
    __tablename__ = "shipping_rates"

    id = Column(Integer, primary_key=True, index=True)
    country = Column(String, index=True)
    weight = Column(Float, index=True)
    type = Column(String, index=True)  
    original_rate = Column(Float)
    discount_rate = Column(String, nullable=True)  
    source = Column(String, index=True)          
    student = Column(Boolean, default=False)     
    zone = Column(String, nullable=True)         
    addkg = Column(Float, nullable=True)  
    surcharges = Column(Float, nullable=True)  

