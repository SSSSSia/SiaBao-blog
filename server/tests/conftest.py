# -*- coding: utf-8 -*-
"""Pytest bootstrap for the backend.

``pyproject.toml`` sets ``pythonpath = ["."]`` so ``import app...`` resolves when
pytest runs from the ``server/`` directory. We add the server root defensively
too, so the suite also works when invoked from an editor without that config.
"""
import sys
from pathlib import Path

_SERVER_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVER_ROOT))
