# Contributing

1. Fork the repository and create a focused branch.
2. Install `pip install -r requirements.lock`, then `pip install --no-deps -e .`, and run
   `pytest` before opening a pull request.
3. Never add production code, customer data, credentials, generated campaign data or `.env`.
4. Keep public publishing out of new flows unless it includes a visible approval gate and a
   verifiable receipt.
5. Add tests for security boundaries, state transitions and new provider adapters.

Bug reports should include the operating system, Python version, provider type, safe reproduction
steps and redacted logs. Use the private process in `SECURITY.md` for vulnerabilities.
