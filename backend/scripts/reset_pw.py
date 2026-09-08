from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.models import User

db = SessionLocal()

for email, new_pw in [
    ("123@123.com",           "123456789"),
    ("adrishio09@gmail.com",  "123456789"),
]:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"NOT FOUND: {email}")
        continue
    h = get_password_hash(new_pw)
    user.hashed_password = h
    db.commit()
    ok = verify_password(new_pw, user.hashed_password)
    print(f"{email} -> updated, verify={ok}")

db.close()
