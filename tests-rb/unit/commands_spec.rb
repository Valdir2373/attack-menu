require_relative "../spec_helper"
require_relative "../../src-rb/ports/input/commands"

RSpec.describe "Command structs" do
  describe Ports::Input::BlockInputCommand do
    it "creates with machine_id and default target" do
      cmd = described_class.new(machine_id: "m1")
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.target).to eq("both")
    end

    it "creates with custom target" do
      cmd = described_class.new(machine_id: "m1", target: "keyboard")
      expect(cmd.target).to eq("keyboard")
    end

    it "is frozen (immutable)" do
      cmd = described_class.new(machine_id: "m1")
      expect { cmd.machine_id = "m2" }.to raise_error(NoMethodError)
    end
  end

  describe Ports::Input::UnblockInputCommand do
    it "creates with machine_id and default target" do
      cmd = described_class.new(machine_id: "m1")
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.target).to eq("both")
    end

    it "creates with custom target" do
      cmd = described_class.new(machine_id: "m1", target: "mouse")
      expect(cmd.target).to eq("mouse")
    end
  end

  describe Ports::Input::ExecuteShellCommand do
    it "creates with machine_id and command" do
      cmd = described_class.new(machine_id: "m1", command: "whoami")
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.command).to eq("whoami")
    end

    it "preserves complex command strings" do
      cmd = described_class.new(machine_id: "m1", command: 'dir C:\\ /s')
      expect(cmd.command).to eq('dir C:\\ /s')
    end

    it "stores empty command" do
      cmd = described_class.new(machine_id: "m1", command: "")
      expect(cmd.command).to eq("")
    end
  end

  describe Ports::Input::FileListCommand do
    it "creates with machine_id and path" do
      cmd = described_class.new(machine_id: "m1", path: 'C:\Users')
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.path).to eq('C:\Users')
    end

    it "stores Unix-style path" do
      cmd = described_class.new(machine_id: "m1", path: "/home/user")
      expect(cmd.path).to eq("/home/user")
    end
  end

  describe Ports::Input::FileDownloadCommand do
    it "creates with machine_id and path" do
      cmd = described_class.new(machine_id: "m1", path: 'C:\secrets.txt')
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.path).to eq('C:\secrets.txt')
    end
  end

  describe Ports::Input::FileUploadCommand do
    it "creates with machine_id, path and data" do
      cmd = described_class.new(machine_id: "m1", path: 'C:\payload.exe', data: "YmFzZTY0ZGF0YQ==")
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.path).to eq('C:\payload.exe')
      expect(cmd.data).to eq("YmFzZTY0ZGF0YQ==")
    end

    it "stores empty data" do
      cmd = described_class.new(machine_id: "m1", path: "f.txt", data: "")
      expect(cmd.data).to eq("")
    end
  end

  describe Ports::Input::FileExecCommand do
    it "creates with machine_id and path" do
      cmd = described_class.new(machine_id: "m1", path: 'C:\payload.exe')
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.path).to eq('C:\payload.exe')
    end
  end

  describe Ports::Input::ScreenStartCommand do
    it "creates with machine_id and default fps" do
      cmd = described_class.new(machine_id: "m1")
      expect(cmd.machine_id).to eq("m1")
      expect(cmd.fps).to eq(5)
    end

    it "creates with custom fps" do
      cmd = described_class.new(machine_id: "m1", fps: 30)
      expect(cmd.fps).to eq(30)
    end

    it "stores fps as integer" do
      cmd = described_class.new(machine_id: "m1", fps: 60)
      expect(cmd.fps).to be_a(Integer)
    end
  end

  describe Ports::Input::ScreenStopCommand do
    it "creates with machine_id" do
      cmd = described_class.new(machine_id: "m1")
      expect(cmd.machine_id).to eq("m1")
    end
  end

  describe Ports::Input::ListMachinesCommand do
    it "creates without any arguments" do
      cmd = described_class.new
      expect(cmd).to be_a(described_class)
    end

    it "does not respond to machine_id" do
      cmd = described_class.new
      expect(cmd.respond_to?(:machine_id)).to be false
    end

    it "is a T::Struct" do
      expect(described_class.ancestors).to include(T::Struct)
    end
  end
end
