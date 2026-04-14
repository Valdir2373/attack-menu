require_relative "../spec_helper"
require_relative "../../src-rb/application/handlers/setup_handler"
require_relative "../../src-rb/application/handlers/execute_handler"
require_relative "../../src-rb/application/handlers/file_handler"
require_relative "../../src-rb/domain/entities/machine"
require_relative "../../src-rb/domain/services/machine_registry"
require_relative "../../src-rb/ports/input/commands"

class MockRelayForHandlers
  include Ports::Output::RelayPort

  attr_reader :agent_messages

  def initialize
    @agent_messages = []
  end

  def send_to_agent(machine_id, payload)
    @agent_messages << { machine_id: machine_id, payload: payload }
  end

  def broadcast_operators(payload); end
  def send_to_viewers(machine_id, payload); end
  def send_to(ws, payload); end
end

RSpec.describe Application::Handlers::SetupHandler do
  let(:registry) { Domain::Services::MachineRegistry.new }
  let(:relay) { MockRelayForHandlers.new }
  subject(:handler) { described_class.new(registry: registry, relay: relay) }

  let(:machine) do
    m = Domain::Entities::Machine.create(name: "PC-01", os: "Win", ip: "1.1.1.1", ws: nil)
    registry.register(m)
    m
  end

  describe "#handle BlockInputCommand" do
    it "returns true for BlockInputCommand" do
      cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id)
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends block_input to agent" do
      cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id)
      handler.handle(cmd, {})

      expect(relay.agent_messages.length).to eq(1)
      expect(relay.agent_messages[0][:payload]["type"]).to eq("block_input")
    end

    it "sets keyboard_blocked on status" do
      cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id, target: "keyboard")
      handler.handle(cmd, {})

      status = registry.status_for(machine.id)
      expect(status.keyboard_blocked).to be true
    end

    it "sets mouse_blocked on status for mouse target" do
      cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id, target: "mouse")
      handler.handle(cmd, {})

      status = registry.status_for(machine.id)
      expect(status.mouse_blocked).to be true
    end

    it "sets both blocked for default 'both' target" do
      cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id)
      handler.handle(cmd, {})

      status = registry.status_for(machine.id)
      expect(status.keyboard_blocked).to be true
      expect(status.mouse_blocked).to be true
    end
  end

  describe "#handle UnblockInputCommand" do
    it "returns true for UnblockInputCommand" do
      cmd = Ports::Input::UnblockInputCommand.new(machine_id: machine.id)
      expect(handler.handle(cmd, {})).to be true
    end

    it "unblocks keyboard and mouse" do
      block_cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id)
      handler.handle(block_cmd, {})

      unblock_cmd = Ports::Input::UnblockInputCommand.new(machine_id: machine.id)
      handler.handle(unblock_cmd, {})

      status = registry.status_for(machine.id)
      expect(status.keyboard_blocked).to be false
      expect(status.mouse_blocked).to be false
    end
  end

  describe "#handle unknown command" do
    it "returns false for unknown commands" do
      cmd = Ports::Input::FileListCommand.new(machine_id: machine.id, path: "/")
      expect(handler.handle(cmd, {})).to be false
    end
  end
end

RSpec.describe Application::Handlers::ExecuteHandler do
  let(:registry) { Domain::Services::MachineRegistry.new }
  let(:relay) { MockRelayForHandlers.new }
  subject(:handler) { described_class.new(registry: registry, relay: relay) }

  let(:machine) do
    m = Domain::Entities::Machine.create(name: "PC-01", os: "Win", ip: "1.1.1.1", ws: nil)
    registry.register(m)
    m
  end

  describe "#handle ExecuteShellCommand" do
    it "returns true" do
      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "whoami")
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends cmd to agent" do
      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "dir")
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("cmd")
      expect(relay.agent_messages[0][:payload]["command"]).to eq("dir")
    end
  end

  describe "#handle ScreenStartCommand" do
    it "returns true" do
      cmd = Ports::Input::ScreenStartCommand.new(machine_id: machine.id, fps: 30)
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends screen_start to agent with fps" do
      cmd = Ports::Input::ScreenStartCommand.new(machine_id: machine.id, fps: 15)
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("screen_start")
      expect(relay.agent_messages[0][:payload]["fps"]).to eq(15)
    end

    it "sets screen_streaming on status" do
      cmd = Ports::Input::ScreenStartCommand.new(machine_id: machine.id)
      handler.handle(cmd, {})

      status = registry.status_for(machine.id)
      expect(status.screen_streaming).to be true
    end
  end

  describe "#handle ScreenStopCommand" do
    it "returns true" do
      cmd = Ports::Input::ScreenStopCommand.new(machine_id: machine.id)
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends screen_stop to agent" do
      cmd = Ports::Input::ScreenStopCommand.new(machine_id: machine.id)
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("screen_stop")
    end
  end

  describe "#handle FileExecCommand" do
    it "returns true" do
      cmd = Ports::Input::FileExecCommand.new(machine_id: machine.id, path: "C:\\payload.exe")
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends file_exec to agent" do
      cmd = Ports::Input::FileExecCommand.new(machine_id: machine.id, path: "C:\\x.exe")
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("file_exec")
      expect(relay.agent_messages[0][:payload]["path"]).to eq("C:\\x.exe")
    end
  end

  describe "#handle unknown" do
    it "returns false for BlockInputCommand" do
      cmd = Ports::Input::BlockInputCommand.new(machine_id: machine.id)
      expect(handler.handle(cmd, {})).to be false
    end
  end
end

RSpec.describe Application::Handlers::FileHandler do
  let(:registry) { Domain::Services::MachineRegistry.new }
  let(:relay) { MockRelayForHandlers.new }
  subject(:handler) { described_class.new(registry: registry, relay: relay) }

  let(:machine) do
    m = Domain::Entities::Machine.create(name: "PC-01", os: "Win", ip: "1.1.1.1", ws: nil)
    registry.register(m)
    m
  end

  describe "#handle FileListCommand" do
    it "returns true" do
      cmd = Ports::Input::FileListCommand.new(machine_id: machine.id, path: "C:\\")
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends file_list to agent" do
      cmd = Ports::Input::FileListCommand.new(machine_id: machine.id, path: "/home")
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("file_list")
      expect(relay.agent_messages[0][:payload]["path"]).to eq("/home")
    end
  end

  describe "#handle FileDownloadCommand" do
    it "returns true" do
      cmd = Ports::Input::FileDownloadCommand.new(machine_id: machine.id, path: "C:\\file.txt")
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends file_download to agent" do
      cmd = Ports::Input::FileDownloadCommand.new(machine_id: machine.id, path: "/etc/passwd")
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("file_download")
    end

    it "sets receiving_file on machine status" do
      cmd = Ports::Input::FileDownloadCommand.new(machine_id: machine.id, path: "C:\\secret.txt")
      handler.handle(cmd, {})

      status = registry.status_for(machine.id)
      expect(status.receiving_file).to eq("C:\\secret.txt")
    end
  end

  describe "#handle FileUploadCommand" do
    it "returns true" do
      cmd = Ports::Input::FileUploadCommand.new(machine_id: machine.id, path: "C:\\x.exe", data: "AAAA")
      expect(handler.handle(cmd, {})).to be true
    end

    it "sends file_upload to agent with data" do
      cmd = Ports::Input::FileUploadCommand.new(machine_id: machine.id, path: "C:\\p.exe", data: "YmFzZTY0")
      handler.handle(cmd, {})

      expect(relay.agent_messages[0][:payload]["type"]).to eq("file_upload")
      expect(relay.agent_messages[0][:payload]["data"]).to eq("YmFzZTY0")
    end
  end

  describe "#handle unknown" do
    it "returns false for ExecuteShellCommand" do
      cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "test")
      expect(handler.handle(cmd, {})).to be false
    end
  end
end
