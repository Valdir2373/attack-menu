require_relative "../spec_helper"
require "rack/utils"
require_relative "../../src-rb/adapters/drivers/token_auth"

RSpec.describe Adapters::Drivers::TokenAuth do
  describe "with empty expected token (no token configured)" do
    subject(:auth) { described_class.new("") }

    it "accepts any token when server has no token configured" do
      expect(auth.valid_token?("anything")).to be true
    end

    it "accepts empty token" do
      expect(auth.valid_token?("")).to be true
    end

    it "accepts random string" do
      expect(auth.valid_token?("random-gibberish-123")).to be true
    end
  end

  describe "with configured expected token" do
    subject(:auth) { described_class.new("secret-operator-token") }

    it "accepts matching token" do
      expect(auth.valid_token?("secret-operator-token")).to be true
    end

    it "rejects wrong token" do
      expect(auth.valid_token?("wrong-token")).to be false
    end

    it "rejects empty token" do
      expect(auth.valid_token?("")).to be false
    end

    it "rejects partial match" do
      expect(auth.valid_token?("secret-operator")).to be false
    end

    it "rejects token with extra characters" do
      expect(auth.valid_token?("secret-operator-token-extra")).to be false
    end

    it "is case sensitive" do
      expect(auth.valid_token?("SECRET-OPERATOR-TOKEN")).to be false
    end
  end

  describe "timing safety" do
    it "uses Rack::Utils.secure_compare internally" do
      auth = described_class.new("test-token")
      expect(Rack::Utils).to receive(:secure_compare).with("test-token", "test-token").and_return(true)
      auth.valid_token?("test-token")
    end

    it "does not use simple == comparison" do
      auth = described_class.new("my-secret")
      expect(Rack::Utils).to receive(:secure_compare).and_call_original
      auth.valid_token?("my-secret")
    end
  end

  describe "different token formats" do
    it "works with UUID-style token" do
      token = "550e8400-e29b-41d4-a716-446655440000"
      auth = described_class.new(token)
      expect(auth.valid_token?(token)).to be true
    end

    it "works with long JWT-style token" do
      token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"
      auth = described_class.new(token)
      expect(auth.valid_token?(token)).to be true
      expect(auth.valid_token?("wrong")).to be false
    end

    it "works with single character token" do
      auth = described_class.new("x")
      expect(auth.valid_token?("x")).to be true
      expect(auth.valid_token?("y")).to be false
    end
  end
end
