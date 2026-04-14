# frozen_string_literal: true

require_relative "../spec_helper"
require_relative "../../src-rb/domain/services/machine_registry"

RSpec.describe Domain::Services::MachineRegistry do
  subject(:registry) { described_class.new }

  let(:machine1) do
    Domain::Entities::Machine.create(name: "PC-01", os: "Windows 10", ip: "192.168.1.10", ws: nil)
  end

  let(:machine2) do
    Domain::Entities::Machine.create(name: "LAPTOP-02", os: "Windows 11", ip: "192.168.1.20", ws: nil)
  end

  describe "#register" do
    it "adiciona máquina ao registry" do
      registry.register(machine1)
      expect(registry.count).to eq(1)
    end

    it "retorna MachineStatus" do
      status = registry.register(machine1)
      expect(status).to be_a(Domain::Entities::MachineStatus)
      expect(status.machine_id).to eq(machine1.id)
    end

    it "registra múltiplas máquinas" do
      registry.register(machine1)
      registry.register(machine2)
      expect(registry.count).to eq(2)
    end
  end

  describe "#unregister" do
    it "remove máquina do registry" do
      registry.register(machine1)
      registry.unregister(machine1.id)
      expect(registry.count).to eq(0)
    end

    it "remove status junto" do
      registry.register(machine1)
      registry.unregister(machine1.id)
      expect(registry.status_for(machine1.id)).to be_nil
    end

    it "não lança erro ao remover ID inexistente" do
      expect { registry.unregister("nonexistent") }.not_to raise_error
    end
  end

  describe "#find" do
    it "retorna máquina por ID" do
      registry.register(machine1)
      found = registry.find(machine1.id)
      expect(found).to eq(machine1)
    end

    it "retorna nil para ID inexistente" do
      expect(registry.find("unknown")).to be_nil
    end
  end

  describe "#status_for" do
    it "retorna status da máquina" do
      registry.register(machine1)
      status = registry.status_for(machine1.id)
      expect(status.machine_id).to eq(machine1.id)
      expect(status.keyboard_blocked).to be false
    end

    it "status é persistente entre chamadas" do
      registry.register(machine1)
      status = registry.status_for(machine1.id)
      status.set_keyboard(true)
      expect(registry.status_for(machine1.id).keyboard_blocked).to be true
    end
  end

  describe "#all" do
    it "retorna array de todas as máquinas" do
      registry.register(machine1)
      registry.register(machine2)
      expect(registry.all).to contain_exactly(machine1, machine2)
    end

    it "retorna array vazio quando vazio" do
      expect(registry.all).to eq([])
    end
  end

  describe "#all_public" do
    it "retorna hashes sem WebSocket" do
      ws = double("WebSocket")
      m = Domain::Entities::Machine.create(name: "X", os: "Win", ip: "1.1.1.1", ws: ws)
      registry.register(m)

      public_list = registry.all_public
      expect(public_list.length).to eq(1)
      expect(public_list[0]).not_to have_key(:ws)
      expect(public_list[0][:name]).to eq("X")
    end
  end

  describe "#count" do
    it "retorna 0 quando vazio" do
      expect(registry.count).to eq(0)
    end

    it "retorna contagem correta" do
      registry.register(machine1)
      registry.register(machine2)
      expect(registry.count).to eq(2)
    end

    it "decrementa após unregister" do
      registry.register(machine1)
      registry.register(machine2)
      registry.unregister(machine1.id)
      expect(registry.count).to eq(1)
    end
  end
end
