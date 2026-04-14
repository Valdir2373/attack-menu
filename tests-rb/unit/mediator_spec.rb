require_relative "../spec_helper"
require_relative "../../src-rb/application/mediator"
require_relative "../../src-rb/domain/entities/machine"
require_relative "../../src-rb/domain/services/machine_registry"
require_relative "../../src-rb/ports/input/commands"
require_relative "../../src-rb/ports/input/command_handler"
require_relative "../../src-rb/ports/output/relay_port"

class MockRelay
  include Ports::Output::RelayPort

  attr_reader :sent_messages, :broadcast_messages, :viewer_messages, :agent_messages

  def initialize
    @sent_messages = []
    @broadcast_messages = []
    @viewer_messages = []
    @agent_messages = []
  end

  def send_to_agent(machine_id, payload)
    @agent_messages << { machine_id: machine_id, payload: payload }
  end

  def broadcast_operators(payload)
    @broadcast_messages << payload
  end

  def send_to_viewers(machine_id, payload)
    @viewer_messages << { machine_id: machine_id, payload: payload }
  end

  def send_to(ws, payload)
    @sent_messages << { ws: ws, payload: payload }
  end
end

class TrueHandler
  include Ports::Input::CommandHandler

  attr_reader :handled_commands

  def initialize
    @handled_commands = []
  end

  def handle(command, context)
    @handled_commands << command
    true
  end
end

class FalseHandler
  include Ports::Input::CommandHandler

  def handle(command, context)
    false
  end
end

RSpec.describe Application::Mediator do
  let(:registry) { Domain::Services::MachineRegistry.new }
  let(:relay) { MockRelay.new }
  subject(:mediator) { described_class.new(registry: registry, relay: relay) }

  let(:machine) do
    Domain::Entities::Machine.create(name: "PC-01", os: "Windows 10", ip: "192.168.1.10", ws: nil)
  end

  describe "#dispatch" do
    it "dispatches to first handler that returns true" do
      handler = TrueHandler.new
      mediator.add_handler(handler)
      registry.register(machine)

      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "whoami")
      mediator.dispatch(cmd, {})

      expect(handler.handled_commands).to have_attributes(length: 1)
    end

    it "skips handlers that return false" do
      false_handler = FalseHandler.new
      true_handler = TrueHandler.new
      mediator.add_handler(false_handler)
      mediator.add_handler(true_handler)
      registry.register(machine)

      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "dir")
      mediator.dispatch(cmd, {})

      expect(true_handler.handled_commands).to have_attributes(length: 1)
    end

    it "stops after the first handler returns true" do
      first_handler = TrueHandler.new
      second_handler = TrueHandler.new
      mediator.add_handler(first_handler)
      mediator.add_handler(second_handler)
      registry.register(machine)

      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "dir")
      mediator.dispatch(cmd, {})

      expect(first_handler.handled_commands).to have_attributes(length: 1)
      expect(second_handler.handled_commands).to be_empty
    end

    it "handles ListMachinesCommand inline" do
      ws = double("WebSocket")
      mediator.dispatch(Ports::Input::ListMachinesCommand.new, { operator_ws: ws })

      expect(relay.sent_messages.length).to eq(1)
      expect(relay.sent_messages[0][:payload]["type"]).to eq("machines")
    end

    it "includes all machines in ListMachinesCommand response" do
      registry.register(machine)
      m2 = Domain::Entities::Machine.create(name: "PC-02", os: "Linux", ip: "10.0.0.1", ws: nil)
      registry.register(m2)

      ws = double("WebSocket")
      mediator.dispatch(Ports::Input::ListMachinesCommand.new, { operator_ws: ws })

      list = relay.sent_messages[0][:payload]["list"]
      expect(list.length).to eq(2)
    end

    it "sends error when machine_id not found" do
      ws = double("WebSocket")
      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: "nonexistent", command: "whoami")
      mediator.dispatch(cmd, { operator_ws: ws })

      expect(relay.sent_messages.length).to eq(1)
      expect(relay.sent_messages[0][:payload]["type"]).to eq("error")
      expect(relay.sent_messages[0][:payload]["error"]).to include("nonexistent")
    end

    it "does not dispatch to handlers when machine not found" do
      handler = TrueHandler.new
      mediator.add_handler(handler)

      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: "missing-id", command: "test")
      mediator.dispatch(cmd, { operator_ws: double("ws") })

      expect(handler.handled_commands).to be_empty
    end

    it "does not send error when no operator_ws in context" do
      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: "missing", command: "test")
      mediator.dispatch(cmd, {})

      expect(relay.sent_messages).to be_empty
    end

    it "does not check machine_id for commands without it" do
      ws = double("WebSocket")
      mediator.dispatch(Ports::Input::ListMachinesCommand.new, { operator_ws: ws })

      expect(relay.sent_messages.length).to eq(1)
    end
  end

  describe "#add_handler" do
    it "adds handler to chain" do
      handler = TrueHandler.new
      mediator.add_handler(handler)
      registry.register(machine)

      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "test")
      mediator.dispatch(cmd, {})

      expect(handler.handled_commands.length).to eq(1)
    end

    it "supports multiple handlers" do
      h1 = FalseHandler.new
      h2 = FalseHandler.new
      h3 = TrueHandler.new
      mediator.add_handler(h1)
      mediator.add_handler(h2)
      mediator.add_handler(h3)
      registry.register(machine)

      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "test")
      mediator.dispatch(cmd, {})

      expect(h3.handled_commands.length).to eq(1)
    end
  end
end
