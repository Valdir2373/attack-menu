import asyncio
import os
import signal
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from infra.app.AppModule import AppModule  # noqa: E402


def handle_shutdown(signum: int, frame: object) -> None:
    print("\n[*] Encerrando servidor...", flush=True)
    sys.exit(0)


async def main() -> None:
    debug           = os.getenv("DEBUG", "false").lower() == "true"
    management_port = int(os.getenv("MANAGEMENT_PORT", "4445"))
    agent_port      = int(os.getenv("AGENT_PORT", "4444"))

    app    = AppModule(debug=debug, management_port=management_port, agent_port=agent_port)
    server = app.get_server()

    signal.signal(signal.SIGINT,  handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
