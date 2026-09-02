import sys
sys.path.insert(0, r"d:\Docker\HueIC IMP\backend")

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import verify_password, get_password_hash

def inspect_and_fix_passwords():
    db = SessionLocal()
    users = db.query(User).all()
    print("=== KIỂM TRA MẬT KHẨU CÁC TÀI KHOẢN ===")
    
    # Đặt lại mật khẩu chuẩn đồng bộ cho tất cả tài khoản mẫu: HueIC@123
    standard_hash = get_password_hash("HueIC@123")
    
    for u in users:
        print(f"\nUser: '{u.username}' | Email: '{u.email}' | Role: {u.role}")
        print(f"  - Check 'HueIC@123': {verify_password('HueIC@123', u.hashed_password)}")
        print(f"  - Check 'Hueic@123': {verify_password('Hueic@123', u.hashed_password)}")
        print(f"  - Check 'admin123':  {verify_password('admin123', u.hashed_password)}")
        
        # Đồng bộ lại mật khẩu chuẩn HueIC@123 cho các tài khoản
        u.hashed_password = standard_hash
        u.is_active = True
        print(f"  -> ✅ Đã đồng bộ mật khẩu chuẩn: 'HueIC@123' cho username '{u.username}'")

    db.commit()
    db.close()
    print("\n🎉 Đã cập nhật xong tất cả tài khoản về mật khẩu chuẩn 'HueIC@123'!")

if __name__ == "__main__":
    inspect_and_fix_passwords()
