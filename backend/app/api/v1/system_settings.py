from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.system_setting import SystemSetting

router = APIRouter()

DEFAULT_WORKING_HOURS = {
    "morning_start": "07:30",
    "morning_end": "11:30",
    "afternoon_start": "13:00",
    "afternoon_end": "17:00",
    "weekend_pause": True,
    "ot_bonus": True,
    "description": "Lịch làm việc chuẩn hành chính HueIC (8h/ngày: 07:30-11:30 & 13:00-17:00, Nghỉ T7 & CN)"
}

class WorkingHoursUpdateSchema(BaseModel):
    morning_start: str = "07:30"
    morning_end: str = "11:30"
    afternoon_start: str = "13:00"
    afternoon_end: str = "17:00"
    weekend_pause: bool = True
    ot_bonus: bool = True

def get_setting_value(db: Session, key: str, default: Any) -> Any:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        return default
    if isinstance(default, bool):
        return setting.value.lower() in ["true", "1", "yes"]
    return setting.value

def set_setting_value(db: Session, key: str, value: Any, description: Optional[str] = None):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    val_str = str(value)
    now = datetime.now(timezone.utc)
    if setting:
        setting.value = val_str
        if description:
            setting.description = description
        setting.updated_at = now
    else:
        setting = SystemSetting(key=key, value=val_str, description=description, updated_at=now)
        db.add(setting)

@router.get("/working-hours")
def get_working_hours_config(db: Session = Depends(get_db)):
    """
    Lấy cấu hình khung giờ làm việc và quy chế SLA / OT của Nhà trường.
    """
    return {
        "morning_start": get_setting_value(db, "working_morning_start", DEFAULT_WORKING_HOURS["morning_start"]),
        "morning_end": get_setting_value(db, "working_morning_end", DEFAULT_WORKING_HOURS["morning_end"]),
        "afternoon_start": get_setting_value(db, "working_afternoon_start", DEFAULT_WORKING_HOURS["afternoon_start"]),
        "afternoon_end": get_setting_value(db, "working_afternoon_end", DEFAULT_WORKING_HOURS["afternoon_end"]),
        "weekend_pause": get_setting_value(db, "working_weekend_pause", DEFAULT_WORKING_HOURS["weekend_pause"]),
        "ot_bonus": get_setting_value(db, "working_ot_bonus", DEFAULT_WORKING_HOURS["ot_bonus"]),
        "standard_text": "8h/ngày (07:30-11:30 & 13:00-17:00, T2-T6, Nghỉ T7 & CN)"
    }

@router.put("/working-hours")
def update_working_hours_config(
    payload: WorkingHoursUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cập nhật khung giờ làm việc hành chính và quy chế SLA của Nhà trường.
    Chỉ BGH hoặc Admin mới có quyền cập nhật.
    """
    # Kiểm tra phân quyền: Chỉ BGH, ADMIN hoặc user có quyền settings:manage / dept:manage
    role_str = str(current_user.role).upper()
    if "ADMIN" not in role_str and "BGH" not in role_str:
        raise HTTPException(status_code=403, detail="Chỉ Ban Giám Hiệu hoặc Quản trị viên mới có quyền cập nhật cấu hình lịch làm việc của Trường.")

    set_setting_value(db, "working_morning_start", payload.morning_start, "Giờ bắt đầu ca sáng")
    set_setting_value(db, "working_morning_end", payload.morning_end, "Giờ kết thúc ca sáng")
    set_setting_value(db, "working_afternoon_start", payload.afternoon_start, "Giờ bắt đầu ca chiều")
    set_setting_value(db, "working_afternoon_end", payload.afternoon_end, "Giờ kết thúc ca chiều")
    set_setting_value(db, "working_weekend_pause", str(payload.weekend_pause), "Đóng băng SLA Thứ 7 & CN")
    set_setting_value(db, "working_ot_bonus", str(payload.ot_bonus), "Thưởng DPI khi hoàn thành ngoài giờ")
    db.commit()

    return {
        "success": True,
        "message": "Đã cập nhật khung giờ làm việc thành công!",
        "config": {
            "morning_start": payload.morning_start,
            "morning_end": payload.morning_end,
            "afternoon_start": payload.afternoon_start,
            "afternoon_end": payload.afternoon_end,
            "weekend_pause": payload.weekend_pause,
            "ot_bonus": payload.ot_bonus
        }
    }
