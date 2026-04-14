# frozen_string_literal: true

require_relative "../spec_helper"
require_relative "../../src-rb/domain/entities/file_batch"

RSpec.describe Domain::Entities::FileBatch do
  subject(:batch) do
    described_class.new(
      machine_id: "m1",
      filename: "payload.exe",
      total_size: 1000,
      direction: "upload",
    )
  end

  describe "#initialize" do
    it "inicia em estado :idle" do
      expect(batch.state).to eq(:idle)
    end

    it "transferred começa em 0" do
      expect(batch.transferred).to eq(0)
    end

    it "armazena metadata" do
      expect(batch.machine_id).to eq("m1")
      expect(batch.filename).to eq("payload.exe")
      expect(batch.total_size).to eq(1000)
      expect(batch.direction).to eq("upload")
    end
  end

  describe "state machine" do
    it "idle → transferring via start!" do
      batch.start!
      expect(batch.state).to eq(:transferring)
    end

    it "transferring → completed via complete!" do
      batch.start!
      batch.complete!
      expect(batch.state).to eq(:completed)
    end

    it "transferring → failed via fail!" do
      batch.start!
      batch.fail!("timeout")
      expect(batch.state).to eq(:failed)
    end

    it "não pode start! se não está idle" do
      batch.start!
      expect { batch.start! }.to raise_error(RuntimeError)
    end

    it "não pode complete! se não está transferring" do
      expect { batch.complete! }.to raise_error(RuntimeError)
    end

    it "fail! pode ser chamado de qualquer estado" do
      batch.fail!("error early")
      expect(batch.state).to eq(:failed)
    end
  end

  describe "#progress!" do
    it "incrementa transferred" do
      batch.start!
      batch.progress!(500)
      expect(batch.transferred).to eq(500)
    end

    it "acumula múltiplos progress" do
      batch.start!
      batch.progress!(300)
      batch.progress!(200)
      batch.progress!(100)
      expect(batch.transferred).to eq(600)
    end

    it "falha se não está transferring" do
      expect { batch.progress!(100) }.to raise_error(RuntimeError)
    end
  end

  describe "#percentage" do
    it "calcula porcentagem correta" do
      batch.start!
      batch.progress!(500)
      expect(batch.percentage).to eq(50.0)
    end

    it "retorna 0 com total_size zero" do
      empty = described_class.new(
        machine_id: "m1", filename: "f", total_size: 0, direction: "download"
      )
      expect(empty.percentage).to eq(0.0)
    end

    it "retorna 100% quando totalmente transferido" do
      batch.start!
      batch.progress!(1000)
      expect(batch.percentage).to eq(100.0)
    end
  end

  describe "#done?" do
    it "false quando idle" do
      expect(batch.done?).to be false
    end

    it "false quando transferring" do
      batch.start!
      expect(batch.done?).to be false
    end

    it "true quando completed" do
      batch.start!
      batch.complete!
      expect(batch.done?).to be true
    end

    it "true quando failed" do
      batch.fail!("err")
      expect(batch.done?).to be true
    end
  end

  describe "#to_h" do
    it "serializa estado completo" do
      batch.start!
      batch.progress!(250)

      h = batch.to_h
      expect(h[:machine_id]).to eq("m1")
      expect(h[:filename]).to eq("payload.exe")
      expect(h[:total_size]).to eq(1000)
      expect(h[:transferred]).to eq(250)
      expect(h[:percentage]).to eq(25.0)
      expect(h[:direction]).to eq("upload")
      expect(h[:state]).to eq(:transferring)
    end
  end
end
