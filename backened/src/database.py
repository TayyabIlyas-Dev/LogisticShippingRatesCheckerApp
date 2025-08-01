# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, declarative_base

# SQLALCHEMY_DATABASE_URL = "sqlite:///./shippingrates.db"

# engine = create_engine(
#     SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
# )
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = declarative_base()



from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

Base = declarative_base() 
# ✅ Function to create engine based on province
def get_engine(province: str):
    db_url = f"sqlite:///./shippingrates_{province}.db"
    return create_engine(db_url, connect_args={"check_same_thread": False})

# ✅ Function to get session factory
def get_session_local(province: str):
    engine = get_engine(province)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ✅ Get a DB session (used with yield/Depends)
def get_db(province: str):
    SessionLocal = get_session_local(province)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
