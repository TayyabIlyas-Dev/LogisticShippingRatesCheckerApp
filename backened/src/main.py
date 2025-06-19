from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

app = FastAPI()

@app.get("/")
async def read_root():
    return {"message": "Hello from API"}

SQLALCHEMY_DATABASE_URL = "sqlite:///./shippingrates.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
