# typed: strict
# frozen_string_literal: true

require "sorbet-runtime"
require "securerandom"

module Domain
  module Entities
    class Machine < T::Struct
      extend T::Sig

      const :id,           String
      const :name,         String
      const :os,           String
      const :ip,           String
      const :connected_at, String
      prop  :ws,           T.untyped

      sig { params(name: String, os: String, ip: String, ws: T.untyped).returns(Machine) }
      def self.create(name:, os:, ip:, ws:)
        new(
          id:           SecureRandom.hex(8),
          name:         name,
          os:           os,
          ip:           ip,
          connected_at: Time.now.utc.iso8601,
          ws:           ws,
        )
      end

      sig { returns(T::Hash[Symbol, T.untyped]) }
      def to_h_public
        { id: id, name: name, os: os, ip: ip, connected_at: connected_at }
      end
    end
  end
end
