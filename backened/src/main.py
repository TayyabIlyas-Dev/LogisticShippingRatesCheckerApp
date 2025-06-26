from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
from sqlalchemy import func  # Add this import at the top


from . import crud, models, schemas
from .models import Base

# Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./shippingrates.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# FastAPI App
app = FastAPI()

# Allow CORS for all origins (can restrict later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Root Route
@app.get("/")
async def read_root():
    return {"message": "Hello from API"}

@app.get("/all-rates")
def get_all_rates(db: Session = Depends(get_db)):
    rates = crud.get_all_rates(db)
    return {"data": [
        {
            "Country": r.country,
            "Weight": r.weight,
            "Type": r.type,
            "Retail Rate": r.original_rate,
            "Discount Rate": r.discount_rate,
            "Student": r.student,
            "Zone": r.zone
        } for r in rates
    ]}



@app.post("/upload-rates")
def upload_rates(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    student: bool = Form(False),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")

    if file_type == "student" and not student:
        raise HTTPException(status_code=400, detail="Student file upload is not allowed unless checkbox is checked.")

    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(file.file.read())
        df = pd.read_excel(temp_path, engine="openpyxl")
        os.remove(temp_path)

        # 🔹 ZONES FILE
        if file_type == "zones":
            if "COUNTRIES" not in df.columns or "ZONE" not in df.columns:
                raise HTTPException(status_code=400, detail="Zones file must include 'COUNTRIES' and 'ZONE' columns.")

            inserted = updated = skipped = 0
            skipped_rows = []
            for _, row in df.iterrows():
                country = str(row["COUNTRIES"]).strip().lower()
                zone = str(row["ZONE"]).strip()

                rates = db.query(models.ShippingRate).filter(func.lower(models.ShippingRate.country) == country).all()
                if not rates:
                    rate = schemas.ShippingRateCreate(
                        country=country,
                        weight=0,
                        type="zone",
                        original_rate=0,
                        discount_rate=None,
                        source="zones",
                        student=False,
                        zone=zone
                    )
                    crud.create_rate(db, rate)
                    inserted += 1
                else:
                    for r in rates:
                        if r.zone == zone:
                            skipped += 1
                            skipped_rows.append(f"{country} - {r.weight}kg - {r.type} (zone matched)")
                            continue
                        r.zone = zone
                        r.student = False
                        db.commit()
                        updated += 1

            return {
                "message": f"✅ Zones file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        # 🔹 ZONES_DOCS or ZONES_PKG FILES
        if file_type in ["zones_docs", "zones_pkg"]:
            expected_columns = ["ZONE", "WEIGHT", "RETAIL RATE"]
            if not all(col in df.columns for col in expected_columns):
                raise HTTPException(status_code=400, detail="File must contain ZONE, WEIGHT, RETAIL RATE columns.")

            inserted = updated = skipped = 0
            skipped_rows = []

            for _, row in df.iterrows():
                try:
                    zone = str(int(float(row["ZONE"]))).strip()
                    weight = float(row["WEIGHT"])
                    retail_rate = float(row["RETAIL RATE"])
                    discount_rate = 0
                except Exception:
                    skipped += 1
                    skipped_rows.append(f"Invalid row format: {row}")
                    continue

                countries = db.query(models.ShippingRate.country).filter(models.ShippingRate.zone == zone).distinct().all()
                if not countries:
                    skipped_rows.append(f"No countries found for zone {zone}")
                    continue

                for country_tuple in countries:
                    country = str(country_tuple[0]).strip().lower()
                    type_ = "docs" if file_type == "zones_docs" else "non-docs"

                    existing = db.query(models.ShippingRate).filter(
                        func.lower(models.ShippingRate.country) == country,
                        models.ShippingRate.weight == weight,
                        models.ShippingRate.type == type_,
                        models.ShippingRate.zone == zone,
                        models.ShippingRate.student == False
                    ).first()

                    if existing:
                        if (
                            existing.original_rate == retail_rate and
                            (existing.discount_rate == discount_rate or (existing.discount_rate is None and discount_rate == 0))
                        ):
                            skipped += 1
                            skipped_rows.append(f"{country} - {weight}kg - {type_} (unchanged)")
                            continue

                        existing.original_rate = retail_rate
                        existing.discount_rate = str(discount_rate)
                        db.commit()
                        updated += 1
                    else:
                        rate = schemas.ShippingRateCreate(
                            country=country,
                            weight=weight,
                            type=type_,
                            original_rate=retail_rate,
                            discount_rate=str(discount_rate),
                            source=file_type,
                            student=False,
                            zone=zone
                        )
                        crud.create_rate(db, rate)
                        inserted += 1

            return {
                "message": f"✅ {file_type.replace('_', ' ').title()} file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        # 🔹 PKG_DISCOUNT FILE (3-column version)
        if file_type == "pkg_discount" and set(df.columns) == {"Country", "Weight", "Discount Rate"}:
            inserted = updated = skipped = 0
            skipped_rows = []

            for _, row in df.iterrows():
                try:
                    country = str(row["Country"]).strip().lower()
                    weight = float(row["Weight"])
                    discount_rate = float(row["Discount Rate"])
                except Exception:
                    skipped += 1
                    skipped_rows.append(f"Invalid row format: {row}")
                    continue

                existing = db.query(models.ShippingRate).filter(
                    func.lower(models.ShippingRate.country) == country,
                    models.ShippingRate.weight == weight,
                    models.ShippingRate.type == "non-docs",
                    models.ShippingRate.student == False
                ).first()

                if existing:
                    existing.discount_rate = str(discount_rate)
                    db.commit()
                    updated += 1
                else:
                    skipped += 1
                    skipped_rows.append(f"{country} - {weight}kg - non-docs (not found)")

            return {
                "message": f"✅ pkg_discount file processed. Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        # 🧩 FALLBACK for COUNTRY-WEIGHT-RATE FILES
        if "COUNTRIES" not in df.columns:
            raise HTTPException(status_code=400, detail="Excel must contain 'COUNTRIES' column.")

        long_df = df.melt(id_vars=["COUNTRIES"], var_name="Weight", value_name="Retail Rate")
        long_df.rename(columns={"COUNTRIES": "Country"}, inplace=True)
        long_df["Country"] = long_df["Country"].astype(str).str.strip().str.lower()
        long_df["Source"] = file_type
        long_df["Weight"] = long_df["Weight"].apply(lambda w: float(str(w).replace("KG", "").strip()))
        long_df["Retail Rate"] = long_df["Retail Rate"].apply(lambda r: float(r) if pd.notnull(r) else None)
        long_df.dropna(subset=["Weight", "Retail Rate"], inplace=True)

        inserted = updated = skipped = 0
        skipped_rows = []

        long_df["Type"] = (
            "non-docs" if file_type in ["pkg_discount", "retail", "student"]
            else "docs" if file_type in ["docs_discount", "docs"]
            else "zone"
        )

        for _, row in long_df.iterrows():
            zone = None
            z_record = db.query(models.ShippingRate).filter(
                func.lower(models.ShippingRate.country) == row["Country"],
                models.ShippingRate.weight == row["Weight"],
                models.ShippingRate.type == row["Type"]
            ).first()
            if z_record:
                zone = z_record.zone

            existing = db.query(models.ShippingRate).filter(
                func.lower(models.ShippingRate.country) == row["Country"],
                models.ShippingRate.weight == row["Weight"],
                models.ShippingRate.type == row["Type"],
                models.ShippingRate.student == (file_type == "student")
            ).first()

            if existing:
                if existing.original_rate == row["Retail Rate"] and (
                    existing.discount_rate == row["Retail Rate"] or existing.discount_rate is None
                ):
                    skipped += 1
                    skipped_rows.append(f"{row['Country']} - {row['Weight']}kg - {row['Type']}")
                    continue
                existing.original_rate = row["Retail Rate"]
                if existing.discount_rate is None:
                    existing.discount_rate = row["Retail Rate"]
                db.commit()
                updated += 1
            else:
                rate = schemas.ShippingRateCreate(
                    country=row["Country"],
                    weight=row["Weight"],
                    type=row["Type"],
                    original_rate=row["Retail Rate"],
                    discount_rate=None,
                    source=row["Source"],
                    student=(file_type == "student"),
                    zone=zone
                )
                crud.create_rate(db, rate)
                inserted += 1

        return {
            "message": f"✅ {file_type.replace('_', ' ').title()} file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
            "skipped_rows": skipped_rows
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ Failed to process file: {str(e)}")










# @app.post("/upload-rates")
# def upload_rates(
#     file: UploadFile = File(...),
#     file_type: str = Form(...),
#     student: bool = Form(False),
#     db: Session = Depends(get_db)
# ):
#     if not file.filename.endswith((".xlsx", ".xls")):
#         raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")

#     if file_type == "student" and not student:
#         raise HTTPException(status_code=400, detail="Student file upload is not allowed unless checkbox is checked.")

#     try:
#         temp_path = f"temp_{file.filename}"
#         with open(temp_path, "wb") as f:
#             f.write(file.file.read())
#         df = pd.read_excel(temp_path, engine="openpyxl")
#         os.remove(temp_path)

#         if file_type == "zones":
#             if "COUNTRIES" not in df.columns or "ZONE" not in df.columns:
#                 raise HTTPException(status_code=400, detail="Zones file must include 'COUNTRIES' and 'ZONE' columns.")

#             inserted = updated = skipped = 0
#             skipped_rows = []
#             for _, row in df.iterrows():
#                 country = row["COUNTRIES"]
#                 zone = str(row["ZONE"]).strip()

#                 rates = db.query(models.ShippingRate).filter(models.ShippingRate.country == country).all()
#                 if not rates:
#                     rate = schemas.ShippingRateCreate(
#                         country=country,
#                         weight=0,
#                         type="zone",
#                         original_rate=0,
#                         discount_rate=None,
#                         source="zones",
#                         student=False,  # force always false
#                         zone=zone
#                     )
#                     crud.create_rate(db, rate)
#                     inserted += 1
#                 else:
#                     for r in rates:
#                         if r.zone == zone:
#                             skipped += 1
#                             skipped_rows.append(f"{country} - {r.weight}kg - {r.type} (zone matched)")
#                             continue
#                         r.zone = zone
#                         r.student = False  # force always false
#                         db.commit()
#                         updated += 1

#             return {
#                 "message": f"✅ Zones file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
#                 "skipped_rows": skipped_rows
#             }
#         if file_type in ["zones_docs", "zones_pkg"]:
#             expected_columns = ["ZONE"]
#             retail_headers = [c for c in df.columns if "KG" in c and "Discount" not in c]
#             discount_headers = [f"{w} Discount" for w in retail_headers]

#             if not retail_headers or not all(d in df.columns for d in discount_headers):
#                 raise HTTPException(status_code=400, detail="File must contain weight-based retail and discount columns.")

#             inserted = updated = skipped = 0
#             skipped_rows = []
#             for _, row in df.iterrows():
#                 zone = str(row["ZONE"]).strip()

#                 countries = db.query(models.ShippingRate.country).filter(models.ShippingRate.zone == zone).distinct().all()
#                 if not countries:
#                     skipped_rows.append(f"No countries found for zone {zone}")
#                     continue

#                 for country_tuple in countries:
#                     country = country_tuple[0]
#                     for retail_col in retail_headers:
#                         try:
#                             weight = float(retail_col.replace("KG", "").strip())
#                             retail_rate = float(row[retail_col])
#                             discount_rate = float(row[f"{retail_col} Discount"])
#                         except:
#                             continue

#                         rate = schemas.ShippingRateCreate(
#                             country=country,
#                             weight=weight,
#                             type="docs" if file_type == "zones_docs" else "non-docs",
#                             original_rate=retail_rate,
#                             discount_rate=str(discount_rate),
#                             source=file_type,
#                             student=False,
#                             zone=zone
#                         )
#                         crud.create_rate(db, rate)
#                         inserted += 1

#             return {
#                 "message": f"✅ {file_type.replace('_', ' ').title()} processed. Inserted: {inserted}, Skipped Zones: {len(skipped_rows)}",
#                 "skipped_rows": skipped_rows
#             }

#         # 📍 All Other Files
#         if "COUNTRIES" not in df.columns:
#             raise HTTPException(status_code=400, detail="Excel must contain 'COUNTRIES' column.")

#         long_df = df.melt(id_vars=["COUNTRIES"], var_name="Weight", value_name="Retail Rate")
#         long_df.rename(columns={"COUNTRIES": "Country"}, inplace=True)
#         long_df["Source"] = file_type
#         long_df["Weight"] = long_df["Weight"].apply(lambda w: float(str(w).replace("KG", "").strip()))
#         long_df["Retail Rate"] = long_df["Retail Rate"].apply(lambda r: float(r) if pd.notnull(r) else None)
#         long_df.dropna(subset=["Weight", "Retail Rate"], inplace=True)

#         inserted = updated = skipped = 0
#         skipped_rows = []

#         long_df["Type"] = (
#             "non-docs" if file_type in ["pkg_discount", "retail", "student"]
#             else "docs" if file_type in ["docs_discount", "docs"]
#             else "zone"
#         )

#         for _, row in long_df.iterrows():
#             zone = None
#             # 🔒 zone only if zone already exists
#             z_record = db.query(models.ShippingRate).filter_by(
#                 country=row["Country"],
#                 weight=row["Weight"],
#                 type=row["Type"]
#             ).first()
#             if z_record:
#                 zone = z_record.zone

#             existing = db.query(models.ShippingRate).filter_by(
#                 country=row["Country"],
#                 weight=row["Weight"],
#                 type=row["Type"],
#                 student=(file_type == "student")
#             ).first()

#             if existing:
#                 if existing.original_rate == row["Retail Rate"] and (
#                     existing.discount_rate == row["Retail Rate"] or existing.discount_rate is None
#                 ):
#                     skipped += 1
#                     skipped_rows.append(f"{row['Country']} - {row['Weight']}kg - {row['Type']}")
#                     continue
#                 existing.original_rate = row["Retail Rate"]
#                 if existing.discount_rate is None:
#                     existing.discount_rate = row["Retail Rate"]
#                 db.commit()
#                 updated += 1
#             else:
#                 rate = schemas.ShippingRateCreate(
#                     country=row["Country"],
#                     weight=row["Weight"],
#                     type=row["Type"],
#                     original_rate=row["Retail Rate"],
#                     discount_rate=None,
#                     source=row["Source"],
#                     student=(file_type == "student"),
#                     zone=zone
#                 )
#                 crud.create_rate(db, rate)
#                 inserted += 1

#         return {
#             "message": f"✅ {file_type.replace('_', ' ').title()} file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
#             "skipped_rows": skipped_rows
#         }

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"❌ Failed to process file: {str(e)}")
