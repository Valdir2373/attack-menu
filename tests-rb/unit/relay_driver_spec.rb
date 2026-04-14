require_relative "../spec_helper"
require_relative "../../src-rb/adapters/drivers/relay_driver"
require_relative "../../src-rb/domain/entities/machine"
require_relative "../../src-rb/domain/services/machine_registry"

RSpec.describe Adapters::Drivers::RelayDriver do
  let(:registry) { Domain::Services::MachineRegistry.new }
  let(:operators) { Set.new }
  let(:viewers) { {} }

  subject(:driver) do
    described_class.new(registry: registry, operators: operators, viewers: viewers)
  end

  let(:ws_mock) { double("WebSocket", send: nil) }

  let(:machine) do
    Domain::Entities::Machine.create(name: "PC-01", os: "Windows 10", ip: "192.168.1.10", ws: ws_mock)
  end

  describe "#send_to_agent" do
    it "sends JSON payload to the machine WebSocket" do
      registry.register(machine)

      expect(ws_mock).to receive(:send).with(anything) do |json_str|
        parsed = JSON.parse(json_str)
        expect(parsed["type"]).to eq("cmd")
        expect(parsed["command"]).to eq("whoami")
      end

      driver.send_to_agent(machine.id, { "type" => "cmd", "command" => "whoami" })
    end

    it "does nothing when machine not found" do
      expect { driver.send_to_agent("nonexistent", { "type" => "test" }) }.not_to raise_error
    end

    it "handles nil ws gracefully" do
      m = Domain::Entities::Machine.create(name: "No-WS", os: "Linux", ip: "10.0.0.1", ws: nil)
      registry.register(m)

      expect { driver.send_to_agent(m.id, { "type" => "cmd" }) }.not_to raise_error
    end
  end

  describe "#broadcast_operators" do
    it "sends JSON to all operators" do
      op1 = double("WS1", send: nil)
      op2 = double("WS2", send: nil)
      operators.add(op1)
      operators.add(op2)

      expect(op1).to receive(:send).once
      expect(op2).to receive(:send).once

      driver.broadcast_operators({ "type" => "machines", "list" => [] })
    end

    it "sends same JSON string to all operators" do
      op1 = double("WS1")
      op2 = double("WS2")
      messages = []
      allow(op1).to receive(:send) { |msg| messages << msg }
      allow(op2).to receive(:send) { |msg| messages << msg }
      operators.add(op1)
      operators.add(op2)

      driver.broadcast_operators({ "type" => "test", "data" => 42 })

      expect(messages.length).to eq(2)
      expect(messages[0]).to eq(messages[1])
    end

    it "does nothing with empty operators set" do
      expect { driver.broadcast_operators({ "type" => "test" }) }.not_to raise_error
    end
  end

  describe "#send_to_viewers" do
    it "sends to viewers watching a specific machine" do
      viewer = double("Viewer", send: nil)
      viewers[machine.id] = Set.new([viewer])

      expect(viewer).to receive(:send).once

      driver.send_to_viewers(machine.id, { "type" => "screen_frame", "data" => "abc" })
    end

    it "sends to multiple viewers for same machine" do
      v1 = double("V1", send: nil)
      v2 = double("V2", send: nil)
      viewers["m1"] = Set.new([v1, v2])

      expect(v1).to receive(:send).once
      expect(v2).to receive(:send).once

      driver.send_to_viewers("m1", { "type" => "screen_frame" })
    end

    it "does nothing when no viewers for machine" do
      expect { driver.send_to_viewers("unknown-machine", { "type" => "test" }) }.not_to raise_error
    end

    it "does nothing when viewers hash has no key for machine" do
      viewers["other"] = Set.new([double("V")])

      expect { driver.send_to_viewers("m1", { "type" => "test" }) }.not_to raise_error
    end
  end

  describe "#send_to" do
    it "sends JSON to a specific WebSocket" do
      ws = double("WS")
      expect(ws).to receive(:send) do |json|
        parsed = JSON.parse(json)
        expect(parsed["type"]).to eq("error")
        expect(parsed["error"]).to eq("not found")
      end

      driver.send_to(ws, { "type" => "error", "error" => "not found" })
    end

    it "handles nil WebSocket gracefully" do
      expect { driver.send_to(nil, { "type" => "test" }) }.not_to raise_error
    end
  end
end
