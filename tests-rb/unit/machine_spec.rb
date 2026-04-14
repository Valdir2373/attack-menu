# frozen_string_literal: true

require_relative "../spec_helper"
require_relative "../../src-rb/domain/entities/machine"

RSpec.describe Domain::Entities::Machine do
  subject(:machine) do
    described_class.create(name: "PC-OFFICE", os: "Windows 10", ip: "192.168.1.10", ws: nil)
  end

  describe ".create" do
    it "gera ID único (hex de 16 chars)" do
      expect(machine.id).to match(/\A[0-9a-f]{16}\z/)
    end

    it "gera IDs diferentes para máquinas diferentes" do
      m2 = described_class.create(name: "PC-2", os: "Linux", ip: "10.0.0.1", ws: nil)
      expect(machine.id).not_to eq(m2.id)
    end

    it "armazena nome da máquina" do
      expect(machine.name).to eq("PC-OFFICE")
    end

    it "armazena SO" do
      expect(machine.os).to eq("Windows 10")
    end

    it "armazena IP" do
      expect(machine.ip).to eq("192.168.1.10")
    end

    it "gera timestamp ISO8601" do
      expect(machine.connected_at).to match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    end

    it "aceita ws nil (sem WebSocket)" do
      expect(machine.ws).to be_nil
    end

    it "aceita ws como mock object" do
      ws = double("WebSocket")
      m = described_class.create(name: "t", os: "Win", ip: "1.2.3.4", ws: ws)
      expect(m.ws).to eq(ws)
    end
  end

  describe "#to_h_public" do
    it "inclui id, name, os, ip, connected_at" do
      h = machine.to_h_public
      expect(h.keys).to contain_exactly(:id, :name, :os, :ip, :connected_at)
    end

    it "NÃO inclui ws (segurança)" do
      expect(machine.to_h_public).not_to have_key(:ws)
    end

    it "preserva valores corretos" do
      h = machine.to_h_public
      expect(h[:name]).to eq("PC-OFFICE")
      expect(h[:os]).to eq("Windows 10")
      expect(h[:ip]).to eq("192.168.1.10")
    end
  end
end
