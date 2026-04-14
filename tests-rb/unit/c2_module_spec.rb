require_relative "../spec_helper"
require_relative "../../src-rb/domain/entities/machine"
require_relative "../../src-rb/domain/entities/machine_status"
require_relative "../../src-rb/domain/entities/file_batch"
require_relative "../../src-rb/domain/services/machine_registry"
require_relative "../../src-rb/application/mediator"
require_relative "../../src-rb/ports/input/commands"
require_relative "../../src-rb/ports/input/command_handler"
require_relative "../../src-rb/ports/output/relay_port"

class StubRelay
  include Ports::Output::RelayPort

  attr_reader :agent_msgs, :broadcast_msgs, :viewer_msgs, :direct_msgs

  def initialize
    @agent_msgs    = []
    @broadcast_msgs = []
    @viewer_msgs   = []
    @direct_msgs   = []
  end

  def send_to_agent(machine_id, payload)
    @agent_msgs << { machine_id: machine_id, payload: payload }
  end

  def broadcast_operators(payload)
    @broadcast_msgs << payload
  end

  def send_to_viewers(machine_id, payload)
    @viewer_msgs << { machine_id: machine_id, payload: payload }
  end

  def send_to(ws, payload)
    @direct_msgs << { ws: ws, payload: payload }
  end
end

class AcceptAllHandler
  include Ports::Input::CommandHandler
  attr_reader :received
  def initialize; @received = []; end
  def handle(command, context); @received << command; true; end
end

class RejectAllHandler
  include Ports::Input::CommandHandler
  def handle(command, context); false; end
end

class ErrorHandler
  include Ports::Input::CommandHandler
  def handle(command, context); raise "boom"; end
end

RSpec.describe "C2 Module - Machine entity" do
  it "generates a 16-char hex ID" do
    m = Domain::Entities::Machine.create(name: "SRV-01", os: "Windows Server 2022", ip: "10.0.0.5", ws: nil)
    expect(m.id).to match(/\A[0-9a-f]{16}\z/)
  end

  it "assigns different IDs to separate instances" do
    ids = 10.times.map do
      Domain::Entities::Machine.create(name: "n", os: "o", ip: "1.1.1.1", ws: nil).id
    end
    expect(ids.uniq.size).to eq(10)
  end

  it "records ISO8601 UTC timestamp at creation" do
    m = Domain::Entities::Machine.create(name: "PC", os: "Win", ip: "1.2.3.4", ws: nil)
    expect(m.connected_at).to match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  end

  it "to_h_public excludes the ws handle" do
    ws = double("WebSocket", send: nil)
    m = Domain::Entities::Machine.create(name: "PC", os: "Win", ip: "1.2.3.4", ws: ws)
    expect(m.to_h_public).not_to have_key(:ws)
    expect(m.to_h_public.keys).to contain_exactly(:id, :name, :os, :ip, :connected_at)
  end

  it "supports Windows 10 os string" do
    m = Domain::Entities::Machine.create(name: "WK-01", os: "Windows 10", ip: "192.168.1.10", ws: nil)
    expect(m.os).to eq("Windows 10")
  end

  it "supports Windows 11 os string" do
    m = Domain::Entities::Machine.create(name: "WK-02", os: "Windows 11", ip: "192.168.1.20", ws: nil)
    expect(m.os).to eq("Windows 11")
  end

  it "supports Windows Server 2019 os string" do
    m = Domain::Entities::Machine.create(name: "DC-01", os: "Windows Server 2019", ip: "10.0.0.1", ws: nil)
    expect(m.os).to eq("Windows Server 2019")
  end

  it "preserves IPv6 address in ip field" do
    m = Domain::Entities::Machine.create(name: "V6", os: "Win", ip: "::1", ws: nil)
    expect(m.ip).to eq("::1")
  end
end

RSpec.describe "C2 Module - MachineStatus" do
  let(:status) { Domain::Entities::MachineStatus.new("machine-abc") }

  it "starts with keyboard_blocked false" do
    expect(status.keyboard_blocked).to be false
  end

  it "starts with mouse_blocked false" do
    expect(status.mouse_blocked).to be false
  end

  it "starts with screen_streaming false" do
    expect(status.screen_streaming).to be false
  end

  it "starts with receiving_file nil" do
    expect(status.receiving_file).to be_nil
  end

  it "notifies observer when keyboard state changes" do
    notifications = []
    status.subscribe { |s| notifications << s.keyboard_blocked }

    status.set_keyboard(true)

    expect(notifications).to eq([true])
  end

  it "notifies observer when screen streaming toggles" do
    states = []
    status.subscribe { |s| states << s.screen_streaming }

    status.set_screen(true)
    status.set_screen(false)

    expect(states).to eq([true, false])
  end

  it "notifies multiple observers on a single change" do
    count_a = 0
    count_b = 0
    status.subscribe { |_| count_a += 1 }
    status.subscribe { |_| count_b += 1 }

    status.set_mouse(true)

    expect(count_a).to eq(1)
    expect(count_b).to eq(1)
  end

  it "serializes current state to hash via to_h" do
    status.set_keyboard(true)
    status.set_receiving_file("C:\\loot.zip")

    h = status.to_h
    expect(h[:machine_id]).to eq("machine-abc")
    expect(h[:keyboard_blocked]).to be true
    expect(h[:receiving_file]).to eq("C:\\loot.zip")
  end
end

RSpec.describe "C2 Module - FileBatch state machine" do
  def make_batch(size: 1024, direction: "download")
    Domain::Entities::FileBatch.new(
      machine_id: "m1",
      filename: "data.bin",
      total_size: size,
      direction: direction,
    )
  end

  it "starts in idle state" do
    batch = make_batch
    expect(batch.state).to eq(:idle)
  end

  it "transitions idle -> transferring via start!" do
    batch = make_batch
    batch.start!
    expect(batch.state).to eq(:transferring)
  end

  it "transitions transferring -> completed via complete!" do
    batch = make_batch
    batch.start!
    batch.complete!
    expect(batch.state).to eq(:completed)
  end

  it "transitions idle -> transferring -> failed via fail!" do
    batch = make_batch
    batch.start!
    batch.fail!("network timeout")
    expect(batch.state).to eq(:failed)
  end

  it "raises on start! from non-idle state" do
    batch = make_batch
    batch.start!
    expect { batch.start! }.to raise_error(RuntimeError, /Cannot start/)
  end

  it "raises on complete! from idle state" do
    batch = make_batch
    expect { batch.complete! }.to raise_error(RuntimeError, /Not transferring/)
  end

  it "calculates percentage based on transferred/total_size" do
    batch = make_batch(size: 2000)
    batch.start!
    batch.progress!(500)
    expect(batch.percentage).to eq(25.0)
  end

  it "reports done? true for completed and failed, false otherwise" do
    batch = make_batch
    expect(batch.done?).to be false
    batch.start!
    expect(batch.done?).to be false
    batch.complete!
    expect(batch.done?).to be true
  end
end

RSpec.describe "C2 Module - MachineRegistry" do
  let(:registry) { Domain::Services::MachineRegistry.new }

  def create_machine(name: "PC", os: "Win", ip: "1.1.1.1")
    Domain::Entities::Machine.create(name: name, os: os, ip: ip, ws: nil)
  end

  it "registers a machine and returns its MachineStatus" do
    m = create_machine
    status = registry.register(m)
    expect(status).to be_a(Domain::Entities::MachineStatus)
    expect(status.machine_id).to eq(m.id)
  end

  it "finds a registered machine by ID" do
    m = create_machine(name: "TARGET-01")
    registry.register(m)
    expect(registry.find(m.id).name).to eq("TARGET-01")
  end

  it "returns nil for unknown machine ID" do
    expect(registry.find("nonexistent")).to be_nil
  end

  it "unregisters a machine removing both machine and status" do
    m = create_machine
    registry.register(m)
    registry.unregister(m.id)

    expect(registry.find(m.id)).to be_nil
    expect(registry.status_for(m.id)).to be_nil
  end

  it "tracks count of registered machines" do
    3.times { |i| registry.register(create_machine(name: "PC-#{i}", ip: "10.0.0.#{i}")) }

    expect(registry.count).to eq(3)
  end

  it "returns all_public without ws field for any machine" do
    m = Domain::Entities::Machine.create(name: "X", os: "Win", ip: "1.2.3.4", ws: double("ws"))
    registry.register(m)

    public_list = registry.all_public
    expect(public_list.length).to eq(1)
    expect(public_list[0]).not_to have_key(:ws)
  end

  it "status_for returns the status tied to a registered machine" do
    m = create_machine
    registry.register(m)
    status = registry.status_for(m.id)

    status.set_keyboard(true)
    expect(registry.status_for(m.id).keyboard_blocked).to be true
  end

  it "handles concurrent machines from different subnets" do
    m1 = create_machine(name: "LAN-01", ip: "192.168.1.10")
    m2 = create_machine(name: "VPN-01", ip: "10.8.0.5")
    registry.register(m1)
    registry.register(m2)

    expect(registry.count).to eq(2)
    expect(registry.find(m1.id)).not_to be_nil
    expect(registry.find(m2.id)).not_to be_nil
  end
end

RSpec.describe "C2 Module - Mediator dispatch" do
  let(:registry) { Domain::Services::MachineRegistry.new }
  let(:relay)    { StubRelay.new }
  let(:mediator) { Application::Mediator.new(registry: registry, relay: relay) }

  let(:machine) do
    m = Domain::Entities::Machine.create(name: "PC-01", os: "Win", ip: "192.168.1.10", ws: nil)
    registry.register(m)
    m
  end

  it "dispatches to the first handler returning true" do
    handler = AcceptAllHandler.new
    mediator.add_handler(handler)
    registry.register(machine) unless registry.find(machine.id)

    cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "whoami")
    mediator.dispatch(cmd, {})

    expect(handler.received.length).to eq(1)
  end

  it "stops chain after first handler accepts" do
    first  = AcceptAllHandler.new
    second = AcceptAllHandler.new
    mediator.add_handler(first)
    mediator.add_handler(second)
    registry.register(machine) unless registry.find(machine.id)

    cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "dir")
    mediator.dispatch(cmd, {})

    expect(first.received.length).to eq(1)
    expect(second.received).to be_empty
  end

  it "skips rejecting handlers and continues to accepting ones" do
    mediator.add_handler(RejectAllHandler.new)
    mediator.add_handler(RejectAllHandler.new)
    acceptor = AcceptAllHandler.new
    mediator.add_handler(acceptor)
    registry.register(machine) unless registry.find(machine.id)

    cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "test")
    mediator.dispatch(cmd, {})

    expect(acceptor.received.length).to eq(1)
  end

  it "sends error to operator when machine_id not found in registry" do
    ws = double("operator_ws")
    cmd = Ports::Input::ExecuteShellCommand.new(machine_id: "ghost", command: "whoami")
    mediator.dispatch(cmd, { operator_ws: ws })

    expect(relay.direct_msgs.length).to eq(1)
    expect(relay.direct_msgs[0][:payload]["type"]).to eq("error")
    expect(relay.direct_msgs[0][:payload]["error"]).to include("ghost")
  end

  it "does not dispatch to handlers when machine is not found" do
    handler = AcceptAllHandler.new
    mediator.add_handler(handler)

    cmd = Ports::Input::ExecuteShellCommand.new(machine_id: "unknown", command: "test")
    mediator.dispatch(cmd, { operator_ws: double("ws") })

    expect(handler.received).to be_empty
  end

  it "handles ListMachinesCommand as fallback sending machine list" do
    registry.register(machine) unless registry.find(machine.id)
    ws = double("operator_ws")
    mediator.dispatch(Ports::Input::ListMachinesCommand.new, { operator_ws: ws })

    expect(relay.direct_msgs.length).to eq(1)
    expect(relay.direct_msgs[0][:payload]["type"]).to eq("machines")
    expect(relay.direct_msgs[0][:payload]["list"].length).to be >= 1
  end

  it "recovers from handler exception and continues chain" do
    mediator.add_handler(ErrorHandler.new)
    acceptor = AcceptAllHandler.new
    mediator.add_handler(acceptor)
    registry.register(machine) unless registry.find(machine.id)

    cmd = Ports::Input::ExecuteShellCommand.new(machine_id: machine.id, command: "test")
    expect { mediator.dispatch(cmd, {}) }.not_to raise_error

    expect(acceptor.received.length).to eq(1)
  end

  it "ListMachinesCommand bypasses machine_id validation" do
    ws = double("operator_ws")
    expect {
      mediator.dispatch(Ports::Input::ListMachinesCommand.new, { operator_ws: ws })
    }.not_to raise_error

    expect(relay.direct_msgs.length).to eq(1)
  end
end
