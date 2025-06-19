from sqlalchemy.orm import Session
from . import models, schemas

def get_all_rates(db: Session):
    return db.query(models.ShippingRate).all()

def create_rate(db: Session, rate: schemas.ShippingRateCreate):
    db_rate = models.ShippingRate(**rate.dict())
    db.add(db_rate)
    db.commit()
    db.refresh(db_rate)
    return db_rate 