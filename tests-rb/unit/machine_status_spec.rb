# frozen_string_literal: true

require_relative "../spec_helper"
require_relative "../../src-rb/domain/entities/machine_status"

RSpec.describe Domain::Entities::MachineStatus do
  subject(:status) { described_class.new("machine-abc") }

  describe "#initialize" do
    it "armazena machine_id" do
      expect(status.machine_id).to eq("machine-abc")
    end

    it "inicia com tudo desligado" do
      expect(status.keyboard_blocked).to be false
      expect(status.mouse_blocked).to be false
      expect(status.screen_streaming).to be false
      expect(status.receiving_file).to be_nil
    end
  end

  describe "#set_keyboard" do
    it "bloqueia keyboard" do
      status.set_keyboard(true)
      expect(status.keyboard_blocked).to be true
    end

    it "desbloqueia keyboard" do
      status.set_keyboard(true)
      status.set_keyboard(false)
      expect(status.keyboard_blocked).to be false
    end

    it "notifica observers" do
      notifications = []
      status.subscribe { |s| notifications << s.keyboard_blocked }
      status.set_keyboard(true)
      expect(notifications).to eq([true])
    end
  end

  describe "#set_mouse" do
    it "bloqueia mouse" do
      status.set_mouse(true)
      expect(status.mouse_blocked).to be true
    end

    it "notifica observers" do
      called = false
      status.subscribe { |_| called = true }
      status.set_mouse(true)
      expect(called).to be true
    end
  end

  describe "#set_screen" do
    it "ativa streaming" do
      status.set_screen(true)
      expect(status.screen_streaming).to be true
    end

    it "desativa streaming" do
      status.set_screen(true)
      status.set_screen(false)
      expect(status.screen_streaming).to be false
    end
  end

  describe "#set_receiving_file" do
    it "seta filename" do
      status.set_receiving_file("payload.exe")
      expect(status.receiving_file).to eq("payload.exe")
    end

    it "limpa com nil" do
      status.set_receiving_file("file.txt")
      status.set_receiving_file(nil)
      expect(status.receiving_file).to be_nil
    end
  end

  describe "Observer pattern" do
    it "suporta múltiplos observers" do
      calls = []
      status.subscribe { |_| calls << :obs1 }
      status.subscribe { |_| calls << :obs2 }
      status.set_keyboard(true)
      expect(calls).to eq(%i[obs1 obs2])
    end

    it "unsubscribe remove observer" do
      calls = []
      block = proc { |_| calls << :called }
      status.subscribe(&block)
      status.unsubscribe(&block)
      status.set_keyboard(true)
      expect(calls).to be_empty
    end

    it "cada mutation notifica" do
      count = 0
      status.subscribe { |_| count += 1 }
      status.set_keyboard(true)
      status.set_mouse(true)
      status.set_screen(true)
      status.set_receiving_file("x.txt")
      expect(count).to eq(4)
    end
  end

  describe "#to_h" do
    it "serializa estado completo" do
      status.set_keyboard(true)
      status.set_screen(true)

      h = status.to_h
      expect(h[:machine_id]).to eq("machine-abc")
      expect(h[:keyboard_blocked]).to be true
      expect(h[:mouse_blocked]).to be false
      expect(h[:screen_streaming]).to be true
      expect(h[:receiving_file]).to be_nil
    end
  end
end
