"""Local-only Promarkia services.

This package replaces the hosted control plane (Firebase, Stripe and managed
tenancy) with SQLite-backed services suitable for a single local workspace.
"""

from . import models as models

__all__ = ["models"]
