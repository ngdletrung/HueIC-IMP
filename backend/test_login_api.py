import requests

def test_logins():
    base_url = "http://localhost:8000/api/v1/auth/login"
    accounts = [
        ("admin", "HueIC@123"),
        ("thcgiang", "HueIC@123"),
        ("qtdt", "HueIC@123"),
        ("ndltrung", "HueIC@123"),
        ("hvnhuong@hueic.edu.vn", "HueIC@123")
    ]
    
    print("=== TEST ĐĂNG NHẬP QUA API ===")
    for username, password in accounts:
        payload = {"username": username, "password": password}
        try:
            res = requests.post(base_url, json=payload, timeout=5)
            if res.status_code == 200:
                data = res.json()
                u = data.get("user", {})
                print(f"✅ Đăng nhập THÀNH CÔNG: '{username}' | Role: {u.get('role')} | Name: {u.get('full_name')}")
            else:
                print(f"❌ Đăng nhập THẤT BẠI: '{username}' -> Code {res.status_code}: {res.text}")
        except Exception as e:
            print(f"⚠️ Lỗi kết nối: {e}")

if __name__ == "__main__":
    test_logins()
