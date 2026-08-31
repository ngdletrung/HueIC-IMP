# MANDATORY WORKSPACE INSTRUCTIONS & RULES

You are working in the **HueIC IMP (HueIC Internal Management Portal)** repository.

## 🚨 CRITICAL DIRECTIVES (MUST FOLLOW ON EVERY TURN):
1. **Always Read & Adhere to `.keywork.md`**:
   - Review and strictly follow all 9 core principles defined in `.keywork.md`.
   - **Fixed Host Ports**: `8880` (Frontend), `8881` (Backend), `8882` (PostgreSQL). NEVER use 80, 5432, 8000.
   - **Container Isolation**: Always prefix containers, networks, volumes with `hueic_imp_`.
   - **Database Safety & Seed Data Guard**: Encode DB passwords with `quote_plus`. Safe migrations (`ADD COLUMN IF NOT EXISTS`). Only seed initial demo data once when DB is completely empty; NEVER resurrect deleted users on restart.
   - **Standard 12 Departments**: `BGH, HCTH, ĐT, QTĐT, TSDV, CKOT, DC, CNTT, NL, KHCB, TTGD, CĐ`.
   - **Multi-Page Modular Structure**: Separate HTML files (`index.html`, `tasks.html`, `settings.html`, `assets.html`, `documents.html`) and dedicated JS files (`dashboard.js`, `tasks.js`, `settings.js`, `common.js`, `api.js`).
   - **PC & Mobile Adaptive UI**: Use `Common.detectAndApplyDeviceClasses()`. On PC render full table, on Mobile render Touch Cards, Mobile Bottom Nav, and Drawer with backdrop.
   - **Root-Cause Diagnosis & Cross-Module Integrity**: Never apply superficial band-aids. Identify root causes, design macro-level solutions, and always verify cross-module dependencies to prevent broken links or side-effects.

2. **AUTONOMOUS PRINCIPLE RECORDING PROTOCOL (DO NOT WAIT FOR USER TO REMIND)**:
   - Whenever the User establishes a new architectural preference, design pattern, UI rule, debugging methodology, or business decision, you **MUST PROACTIVELY AND AUTOMATICALLY** write/update it into `.keywork.md` in that exact same turn without requiring the user to explicitly ask.

3. **MANDATORY HISTORY.MD UPDATE ON EVERY CHANGE**:
   - Every single time you make code modifications, add features, fix bugs, adjust the database schema, or update the UI, you **MUST** update `HISTORY.md` with the version/timestamp, description of changes, files touched, and technical notes before ending your turn.

4. **MANDATORY README.MD UPDATE ON ARCHITECTURAL / STRUCTURAL CHANGES**:
   - Whenever you change project architecture, directory structure, port allocations, or add new modules, you **MUST** update `README.md` to keep documentation 100% accurate.
