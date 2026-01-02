from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import re
from sqlalchemy import func ,cast, String  # Add this import at the top
from . import crud, models, schemas
from .models import Base
from fastapi import Query
from fastapi import Request


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

# 📌 Get session based on province
def get_session(province: str):
    db_path = f"sqlite:///./shippingrates_{province}.db"
    engine = create_engine(db_path, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def get_db(province: str):
    db_path = f"sqlite:///./shippingrates_{province}.db"
    engine = create_engine(db_path, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def normalize_zone(zone_str: str) -> str:
    zone_float = float(zone_str)
    return str(int(zone_float)) if zone_float.is_integer() else str(zone_float)

def ensure_table_exists_for(province: str):
    db_path = f"sqlite:///./shippingrates_{province}.db"
    engine = create_engine(db_path, connect_args={"check_same_thread": False})
    from .models import Base
    Base.metadata.create_all(bind=engine)


for province in ["sindh", "punjab", "balochistan"]:
    ensure_table_exists_for(province)

# Dependency

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
async def read_root():
    return {"message": "Hello from API"}

# ✅ Common function to reuse
def get_province_rates(province: str):
    db = get_session(province)
    rates = crud.get_all_rates(db)
    return {
        "province": province,
        "data": [
            {
                "Country": r.country,
                "Weight": r.weight,
                "Type": r.type,
                "Retail Rate": r.original_rate,
                "Discount Rate": r.discount_rate,
                "Student": r.student,
                "Zone": r.zone,
                "Addkg": r.addkg,
                "Surcharges": r.surcharges
            } for r in rates
        ]
    }

# 📍 Sindh
@app.get("/sindh-rates")
def get_sindh_rates():
    return get_province_rates("sindh")

# 📍 Punjab
@app.get("/punjab-rates")
def get_punjab_rates():
    return get_province_rates("punjab")

# 📍 Balochistan
@app.get("/balochistan-rates")
def get_balochistan_rates():
    return get_province_rates("balochistan")


@app.get("/all-rates")
def get_all_rates():
    all_data = []
    for province in ["sindh", "punjab", "balochistan"]:
        session = get_session(province)
        rates = crud.get_all_rates(session)
        all_data.append({
            "province": province,
            "data": [
                {
                    "Country": r.country,
                    "Weight": r.weight,
                    "Type": r.type,
                    "Retail Rate": r.original_rate,
                    "Discount Rate": r.discount_rate,
                    "Student": r.student,
                    "Zone": r.zone,
                    "Addkg": r.addkg,
                    "Surcharges": r.surcharges
                } for r in rates
            ]
        })
    return {"rates": all_data}


def get_db_for_upload(province: str = Form(...)):
    return next(get_db(province))

@app.post("/upload-rates")
def upload_rates(
    request: Request,
    file: UploadFile = File(...),
    province: str = Form(...),
    file_type: str = Form(...),
    student: bool = Form(False),
    sheet: int = Form(1),
    db: Session = Depends(get_db_for_upload)
):
    # db = next(get_db(province)) 
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")

    if file_type == "student" and not student:
        raise HTTPException(status_code=400, detail="Student file upload is not allowed unless checkbox is checked.")

    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(file.file.read())
            sheet_index = sheet - 1  # because pandas uses 0-based index
            df = pd.read_excel(temp_path, sheet_name=sheet_index, engine="openpyxl")
        # os.remove(temp_path)

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

        # 🔹 ZONES_DOCS or ZONES_PKG FILES (wide format supported)
        if file_type in ["zones_docs", "zones_pkg"]:
            if "WEIGHT" not in df.columns:
                raise HTTPException(status_code=400, detail="Excel must contain 'WEIGHT' column as first column.")

            df = pd.melt(df, id_vars=["WEIGHT"], var_name="ZONE", value_name="RETAIL RATE")
            df.dropna(subset=["RETAIL RATE"], inplace=True)

            inserted = updated = skipped = 0
            skipped_rows = []

            for _, row in df.iterrows():
                try:
                    zone_raw = str(row["ZONE"]).strip()

                    # ✅ STRICT: Must start with "Zone" (case-insensitive)
                    if not zone_raw.lower().startswith("zone"):
                        raise ValueError(f"Zone format invalid: '{zone_raw}'")
                    


                    zone_str = re.sub(r"(?i)zone", "", zone_raw).strip()

                    # ✅ STRICT: Must be numeric
                    if not re.fullmatch(r"\d+(\.\d+)?", zone_str):
                        raise ValueError(f"Zone value not numeric: '{zone_str}'")

                    zone_float = float(zone_str)
                    zone = str(int(zone_float)) if zone_float.is_integer() else str(zone_float)  # ✅ Converts 1.0 → "1"       # Cleaned zone string


                    weight = float(row["WEIGHT"])
                    retail_rate = float(row["RETAIL RATE"])
                    discount_rate = 0
                except Exception as e:
                    skipped += 1
                    skipped_rows.append(f"⛔ Skipped row due to error: {e} | Row: {row}")
                    continue
       
                countries = db.query(models.ShippingRate.country).filter(
                    cast(models.ShippingRate.zone, String) == zone
                ).distinct().all()


                if not countries:
                    skipped_rows.append(f"⚠️ No countries found for zone {zone}")
                    continue

                for country_tuple in countries:
                    country = str(country_tuple[0]).strip().lower()
                    type_ = "docs" if file_type == "zones_docs" else "non-docs"

                    existing = db.query(models.ShippingRate).filter(
                        func.lower(models.ShippingRate.country) == country,
                        models.ShippingRate.weight == weight,
                        models.ShippingRate.type == type_,
                        cast(models.ShippingRate.zone, String) == zone,
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


        if file_type == "pkg_discount":
            inserted = updated = skipped = 0
            skipped_rows = []

            # ✅ Enforce strict structure
            required_first_column = "COUNTRIES"
            if df.columns[0].strip().upper() != required_first_column:
                raise HTTPException(
                    status_code=400,
                    detail=f"'pkg_discount' must start with '{required_first_column}' column."
                )

            # ✅ Rename 'COUNTRIES' to standard internal column
            df = df.rename(columns={df.columns[0]: "Country"})

            # ✅ Ensure weight columns follow pattern (e.g., "1 KG")
            weight_columns = [col for col in df.columns if col != "Country"]
            if not weight_columns:
                raise HTTPException(status_code=400, detail="No weight columns found in 'pkg_discount' file.")

            for col in weight_columns:
                match = re.fullmatch(r"^\s*\d+(\.\d+)?\s*KG\s*$", col, re.IGNORECASE)
                if not match:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid weight column name: '{col}'. Must be like '1 KG', '0.5 KG', etc."
                    )

            for _, row in df.iterrows():
                country = str(row["Country"]).strip().lower()

                for col in weight_columns:
                    try:
                        weight_val = float(col.strip().upper().replace("KG", "").strip())
                        discount_rate = float(row[col])
                    except Exception:
                        skipped += 1
                        skipped_rows.append(f"⛔ Invalid row: {row['Country']} → {col}")
                        continue

                    existing = db.query(models.ShippingRate).filter(
                        func.lower(models.ShippingRate.country) == country,
                        models.ShippingRate.weight == weight_val,
                        models.ShippingRate.type == "non-docs",
                        models.ShippingRate.student == False
                    ).first()

                    if existing:
                        existing.discount_rate = str(discount_rate)
                        db.commit()
                        updated += 1
                    else:
                        skipped += 1
                        skipped_rows.append(f"{country} - {weight_val}kg - non-docs (not found)")

            return {
                "message": f"✅ Strictly pkg_discount processed. Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        if file_type == "addkg":
            # 🔹 Re-read only for ADD KG file to support 2-row horizontal layout
            df_addkg = pd.read_excel(temp_path, sheet_name=sheet_index, engine="openpyxl", header=None)

            if df_addkg.shape[0] < 2:
                raise HTTPException(status_code=400, detail="ADD KG file must have at least 2 rows: 'COUNTRIES' and 'ADD KG'.")

            header = df_addkg.iloc[0].tolist()  # First row
            if str(header[0]).strip().upper() != "COUNTRIES":
                raise HTTPException(status_code=400, detail="First cell must be 'COUNTRIES'.")

            second_row = df_addkg.iloc[1].tolist()
            if str(second_row[0]).strip().upper() != "ADD KG":
                raise HTTPException(status_code=400, detail="Second row must start with 'ADD KG' label.")

            countries = header[1:]
            addkg_values = second_row[1:]


            inserted = updated = skipped = 0
            skipped_rows = []

            for i, country_col in enumerate(countries):
                if pd.isna(country_col):
                   continue  # ✅ Skip blank country columns

                addkg_val = addkg_values[i]
                if pd.isna(addkg_val):
                    continue  # ✅ Skip blank ADD KG cells
                country = str(country_col).strip().lower()
                addkg_val = addkg_values[i]


                try:
                    addkg = float(addkg_val)
                except:
                    skipped += 1
                    skipped_rows.append(f"⛔ Invalid ADD KG value for {country}")
                    continue

                zone = None  
                existing_addkg = db.query(models.ShippingRate).filter(
                    func.lower(models.ShippingRate.country) == country,
                    models.ShippingRate.type == "add-kg"
                ).first()

                if existing_addkg:
                    if existing_addkg.addkg == addkg:
                        skipped += 1
                        skipped_rows.append(f"{country} (same addkg)")
                    else:
                        existing_addkg.addkg = addkg
                        db.commit()
                        updated += 1
                else:
                    rate = schemas.ShippingRateCreate(
                        country=country,
                        weight=0,
                        type="add-kg",
                        original_rate=0,
                        discount_rate="0",
                        source="addkg",
                        student=False,
                        zone=zone,
                        addkg=addkg  
                    )
                    crud.create_rate(db, rate)
                    inserted += 1

            return {
                "message": f"✅ ADD KG file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        if file_type == "zoneaddkg":
            df_zoneadd = pd.read_excel(temp_path, sheet_name=sheet_index, engine="openpyxl", header=None)

            if df_zoneadd.shape[0] < 2:
                raise HTTPException(status_code=400, detail="zoneaddkg file must have at least 2 rows.")

            header = df_zoneadd.iloc[0].tolist()
            if str(header[0]).strip().upper() != "COUNTRIES":
                raise HTTPException(status_code=400, detail="First cell must be 'COUNTRIES'.")

            second_row = df_zoneadd.iloc[1].tolist()
            if str(second_row[0]).strip().upper() != "ADD KG":
                raise HTTPException(status_code=400, detail="Second row must start with 'ADD KG'.")

            zone_labels = header[1:]
            addkg_values = second_row[1:]

            inserted = updated = skipped = 0
            skipped_rows = []

            for i, zone_col in enumerate(zone_labels):
                if pd.isna(zone_col):
                    continue

                raw_zone = str(zone_col).strip()
                zone_match = re.search(r"\d+", raw_zone)
                if not zone_match:
                    skipped += 1
                    skipped_rows.append(f"⚠️ Invalid zone label: {raw_zone}")
                    continue

                zone = zone_match.group()
                addkg_val = addkg_values[i]
                if pd.isna(addkg_val):
                    continue

                try:
                    addkg = float(addkg_val)
                except:
                    skipped += 1
                    skipped_rows.append(f"⛔ Invalid ADD KG value for Zone {zone}")
                    continue

                # 🔍 Get all countries in that zone
                countries = db.query(models.ShippingRate.country).filter(
                    cast(models.ShippingRate.zone, String) == zone
                ).distinct().all()

                if not countries:
                    skipped += 1
                    skipped_rows.append(f"⚠️ No countries found for Zone {zone}")
                    continue

                for country_tuple in countries:
                    country = str(country_tuple[0]).strip().lower()



                    existing_addkg = db.query(models.ShippingRate).filter(
                        func.lower(models.ShippingRate.country) == country,
                        models.ShippingRate.type == "add-kg",
                        cast(models.ShippingRate.zone, String) == zone
                    ).first()

                    if existing_addkg:
                        if existing_addkg.addkg == addkg:
                            skipped += 1
                            skipped_rows.append(f"{country} (same addkg)")
                        else:
                            existing_addkg.addkg = addkg
                            db.commit()
                            updated += 1
                    else:
                        rate = schemas.ShippingRateCreate(
                            country=country,
                            weight=0,
                            type="add-kg",
                            original_rate=0,
                            discount_rate="0",
                            source="zoneaddkg",
                            student=False,
                            zone=zone,
                            addkg=addkg
                        )
                        crud.create_rate(db, rate)
                        inserted += 1

            return {
                "message": f"✅ ZONE ADD KG file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        if file_type == "surcharges":
            df_surcharge = pd.read_excel(temp_path, sheet_name=sheet_index, engine="openpyxl")

            df_surcharge.columns = [col.strip().upper() for col in df_surcharge.columns]

            required_columns = ["COUNTRIES", "SURCHARGES"]
            missing = [col for col in required_columns if col not in df_surcharge.columns]
            if missing:
                raise HTTPException(status_code=400, detail=f"Missing columns in surcharges file: {', '.join(missing)}")

            inserted = updated = skipped = 0
            skipped_rows = []

            for index, row in df_surcharge.iterrows():
                country_raw = str(row["COUNTRIES"]).strip()
                country_normalized = str(re.sub(r'\s+', ' ', country_raw)).strip().lower()

                surcharge_value_raw = str(row["SURCHARGES"]).strip()
                surcharge_value_clean = surcharge_value_raw.replace("$", "").strip()

                try:
                    surcharge_value = float(surcharge_value_clean)
                except:
                    skipped += 1
                    skipped_rows.append(f"⛔ Invalid surcharge value for {country_normalized}: {surcharge_value_raw}")
                    continue

                existing_zone_record = db.query(models.ShippingRate).filter(
                    func.lower(func.trim(models.ShippingRate.country)) == country_normalized,
                    models.ShippingRate.zone.isnot(None)
                ).first()

                zone = existing_zone_record.zone if existing_zone_record else None

                existing = db.query(models.ShippingRate).filter(
                    func.lower(func.trim(models.ShippingRate.country)) == country_normalized,
                    models.ShippingRate.weight == 0.0,
                    models.ShippingRate.type == "sur-charges",
                    func.coalesce(models.ShippingRate.original_rate, 0) == 0.0,
                    func.coalesce(models.ShippingRate.addkg, 0) == 0.0
                ).first()

                if existing:
                    if abs(existing.surcharges - surcharge_value) < 0.001:
                        skipped += 1
                        skipped_rows.append(f"{country_normalized} (no change)")
                    else:
                        existing.surcharges = surcharge_value
                        db.commit()
                        updated += 1
                else:
                    rate = schemas.ShippingRateCreate(
                        country=country_normalized,
                        weight=0,
                        type="sur-charges",
                        original_rate=0,
                        discount_rate="0",
                        source="surcharges",
                        student=False,
                        zone=zone,
                        addkg=0,
                        surcharges=surcharge_value
                    )
                    crud.create_rate(db, rate)
                    inserted += 1

            return {
                "message": f"✅ Surcharges file processed. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}.",
                "skipped_rows": skipped_rows
            }

        # 🔹 COUNTRY-WEIGHT-RATE FILES - Only New Format
        if "WEIGHT" not in df.columns:
            raise HTTPException(status_code=400, detail="Excel must contain a 'WEIGHT' column in the first column.")

        long_df = df.melt(id_vars=["WEIGHT"], var_name="Country", value_name="Retail Rate")
        long_df.rename(columns={"WEIGHT": "Weight"}, inplace=True)

        long_df["Country"] = long_df["Country"].astype(str).str.strip().str.lower()
        long_df["Weight"] = long_df["Weight"].apply(lambda w: float(str(w).replace("KG", "").strip()))
        long_df["Retail Rate"] = pd.to_numeric(long_df["Retail Rate"], errors="coerce")
        long_df["Source"] = file_type
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
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def get_db_with_query_param(province: str = Query(...)):
    return next(get_db(province))

@app.delete("/clear-database")
def clear_database(
    province: str = Query(...),
    db: Session = Depends(get_db_with_query_param)
):
    try:
        num_deleted = db.query(models.ShippingRate).delete()
        db.commit()
        return {"message": f"{num_deleted} lines removed from {province} database"}  # ✅ fixed
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"❌ Failed to clear database: {str(e)}")




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
