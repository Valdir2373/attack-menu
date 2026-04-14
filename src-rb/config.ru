require_relative "main"

Faye::WebSocket.load_adapter("thin")
run C2Server
