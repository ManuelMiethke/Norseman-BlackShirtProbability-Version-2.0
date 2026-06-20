from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    dashboard_dir = repo_root / "Norseman_Bachelor_Dashboard_only Kopie 2" / "dashboard"
    sys.path.insert(0, str(dashboard_dir))

    from core.validators import validate_dashboard_assets

    summary = validate_dashboard_assets()
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
