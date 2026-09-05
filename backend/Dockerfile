FROM python:3.11-slim

WORKDIR /app

# Cài đặt các gói phụ trợ hệ thống cần thiết cho psycopg2 và mạng
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy mã nguồn
COPY . .

# Khởi chạy uvicorn server trên port 8000 với reload an toàn chỉ trên thư mục app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"]

