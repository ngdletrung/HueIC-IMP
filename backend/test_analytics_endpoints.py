import urllib.request, urllib.parse, json

def test():
    # Login as admin
    data = urllib.parse.urlencode({"username": "admin", "password": "HueIC@123"}).encode('utf-8')
    req = urllib.request.Request("http://localhost:8000/api/v1/auth/login", data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    res = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    tok = res["access_token"]
    print("🔑 Admin Token lấy thành công!")

    # Test /stats/analytics
    req1 = urllib.request.Request("http://localhost:8000/api/v1/stats/analytics", headers={"Authorization": f"Bearer {tok}"})
    res1 = json.loads(urllib.request.urlopen(req1).read().decode('utf-8'))
    print("✅ /stats/analytics:", json.dumps(res1, ensure_ascii=False)[:300] + "...")

    # Test /stats/workload-alerts
    req2 = urllib.request.Request("http://localhost:8000/api/v1/stats/workload-alerts", headers={"Authorization": f"Bearer {tok}"})
    res2 = json.loads(urllib.request.urlopen(req2).read().decode('utf-8'))
    print("✅ /stats/workload-alerts:", json.dumps(res2, ensure_ascii=False)[:300] + "...")

    # Test /kpi/audit-logs
    req3 = urllib.request.Request("http://localhost:8000/api/v1/kpi/audit-logs", headers={"Authorization": f"Bearer {tok}"})
    res3 = json.loads(urllib.request.urlopen(req3).read().decode('utf-8'))
    print("✅ /kpi/audit-logs (count):", len(res3))

if __name__ == "__main__":
    test()
