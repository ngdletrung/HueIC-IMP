import logging
import os
import sys
from logging.handlers import RotatingFileHandler

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "hueic_imp.log")

def setup_logging():
    """
    Thiết lập hệ thống ghi log tập trung có cấu trúc (Centralized Structured Logging).
    - Xuất log ra Console (stdout) cho Docker container logs.
    - Ghi log xoay vòng (RotatingFileHandler max 10MB, giữ lại 5 backups) ra file hueic_imp.log.
    """
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 1. Console Handler (Docker logs)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # 2. Rotating File Handler
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Cấu hình root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Tránh duplicate handlers nếu setup_logging được gọi lại
    if not root_logger.handlers:
        root_logger.addHandler(console_handler)
        root_logger.addHandler(file_handler)
    else:
        root_logger.handlers = [console_handler, file_handler]

    # Giảm nhiễu từ các thư viện bên ngoài nếu cần
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("passlib").setLevel(logging.ERROR)

    logger = logging.getLogger("hueic_imp")
    logger.info("🚀 [HueIC IMP] Hệ thống Logging tập trung đã được kích hoạt thành công!")
    return logger
