from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from fastapi.responses import JSONResponse
import pandas as pd
from . import crud, models, schemas
import os
from fastapi.middleware.cors import CORSMiddleware
from .models import Base

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"message": "Hello from API"}

SQLALCHEMY_DATABASE_URL = "sqlite:///./shippingrates.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()

@app.get("/all-rates")
def get_all_rates(db: Session = Depends(get_db)):
    rates = crud.get_all_rates(db)
    # Format as expected by frontend
    data = []
    for r in rates:
        data.append({
            "Country": r.country,
            "Weight": r.weight,
            "Type": r.type,
            "Retail Rate": r.original_rate,
            "Discount Rate": r.discount_rate
        })
    return {"data": data}

@app.post("/upload-rates")
def upload_rates(
    file: UploadFile = File(...),
    type: str = Form("docs"),  # Accept type from form, default to 'docs'
    db: Session = Depends(get_db)
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")
    try:
        # Save file temporarily
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(file.file.read())

        df = pd.read_excel(temp_path, engine="openpyxl")
        os.remove(temp_path)

        # Ensure 'COUNTRIES' column exists
        if "COUNTRIES" not in df.columns:
            raise HTTPException(status_code=400, detail="Excel must contain 'COUNTRIES' column.")

        # Melt the DataFrame: Convert wide format to long format
        long_df = df.melt(id_vars=["COUNTRIES"], var_name="Weight", value_name="Retail Rate")
        long_df.rename(columns={"COUNTRIES": "Country"}, inplace=True)

        # Use the provided type for all rows
        long_df["Type"] = type

        # Set Discount Rate as 0 or same as Retail if not provided
        long_df["Discount Rate"] = long_df["Retail Rate"]

        # Clear existing records
        db.query(models.ShippingRate).delete()
        db.commit()

        # Insert new records
        for _, row in long_df.iterrows():
            rate = schemas.ShippingRateCreate(
                country=row["Country"],
                weight=float(str(row["Weight"]).replace("KG", "").strip()),
                type=row["Type"],
                original_rate=float(row["Retail Rate"]),
                discount_rate=str(row["Discount Rate"])
            )
            crud.create_rate(db, rate)

        return {"message": "Rates uploaded and converted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
