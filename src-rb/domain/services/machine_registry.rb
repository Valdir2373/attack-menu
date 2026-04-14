# typed: strict
# frozen_string_literal: true

require "sorbet-runtime"
require_relative "../entities/machine"

module Domain
  module Services
    class MachineRegistry
      extend T::Sig

      sig { void }
      def initialize
        @machines = T.let({}, T::Hash[String, Entities::Machine])
      end

      sig { params(machine: Entities::Machine).void }
      def register(machine)
        @machines[machine.id] = machine
      end

      sig { params(id: String).void }
      def unregister(id)
        @machines.delete(id)
      end

      sig { params(id: String).returns(T.nilable(Entities::Machine)) }
      def find(id)
        @machines[id]
      end

      sig { returns(Integer) }
      def count
        @machines.size
      end

      sig { returns(T::Array[T::Hash[Symbol, T.untyped]]) }
      def all_public
        @machines.values.map(&:to_h_public)
      end
    end
  end
end
