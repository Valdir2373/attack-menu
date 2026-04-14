#!/bin/bash
# docker-manage.sh — Gerencia toda a infraestrutura Docker do AttackMenu
#
# Uso:
#   ./scripts/docker-manage.sh build     # Build todas as imagens
#   ./scripts/docker-manage.sh up        # Sobe py-server + rb-server
#   ./scripts/docker-manage.sh cli       # Roda CLI interativo
#   ./scripts/docker-manage.sh test      # Roda todos os testes
#   ./scripts/docker-manage.sh test-db   # Só testes de banco
#   ./scripts/docker-manage.sh test-c2   # Só teste C2 agent
#   ./scripts/docker-manage.sh down      # Para tudo
#   ./scripts/docker-manage.sh clean     # Remove containers + volumes
#   ./scripts/docker-manage.sh status    # Status de tudo
#   ./scripts/docker-manage.sh logs      # Logs dos servers

set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

COMPOSE="docker compose"
COMPOSE_TEST="docker compose -f docker-compose.test.yml"

case "${1:-help}" in

  build)
    echo -e "${BOLD}Building all images...${RESET}"
    $COMPOSE build py-server rb-server cli
    $COMPOSE --profile build build compiler
    echo -e "${GREEN}Done.${RESET}"
    ;;

  up)
    echo -e "${BOLD}Starting servers...${RESET}"
    $COMPOSE up -d py-server rb-server
    echo -e "${GREEN}py-server → :4445  |  rb-server → :4444 / :8080${RESET}"
    $COMPOSE ps
    ;;

  cli)
    echo -e "${BOLD}Starting CLI...${RESET}"
    $COMPOSE run --rm cli
    ;;

  test)
    echo -e "${BOLD}Running full test suite...${RESET}"
    echo ""

    echo -e "${CYAN}[1/5] Starting test databases...${RESET}"
    $COMPOSE_TEST up -d test-mongo test-mysql test-postgres test-redis
    echo "Waiting for health checks..."
    $COMPOSE_TEST up -d --wait test-mongo test-mysql test-postgres test-redis 2>/dev/null || sleep 10

    echo -e "${CYAN}[2/5] TypeScript tests...${RESET}"
    npx tsc --noEmit && npx vitest run

    echo -e "${CYAN}[3/5] Python tests...${RESET}"
    KEY_CRIP_DATA=test-key-docker \
    MONGO_TEST_URI="mongodb://root:testpass123@localhost:17017/testdb?authSource=admin" \
    MYSQL_TEST_URI="mysql://root:testpass123@localhost:13306/testdb" \
    PG_TEST_URI="postgresql://postgres:testpass123@localhost:15432/testdb" \
    REDIS_TEST_URI="redis://localhost:16379/0" \
    python3 -m pytest tests-p/ -v --timeout=30

    echo -e "${CYAN}[4/5] Ruby tests...${RESET}"
    rspec tests-rb/ --format documentation

    echo -e "${CYAN}[5/5] C crypto tests...${RESET}"
    gcc -O2 compiler/ransom/tests/test_crypto.c -o /tmp/test_crypto -lssl -lcrypto
    /tmp/test_crypto

    echo ""
    echo -e "${GREEN}${BOLD}ALL TESTS PASSED${RESET}"
    ;;

  test-db)
    echo -e "${BOLD}Starting test databases...${RESET}"
    $COMPOSE_TEST up -d test-mongo test-mysql test-postgres test-redis
    sleep 5
    echo -e "${CYAN}Running DB integration tests...${RESET}"
    KEY_CRIP_DATA=test-key-docker \
    MONGO_TEST_URI="mongodb://root:testpass123@localhost:17017/testdb?authSource=admin" \
    MYSQL_TEST_URI="mysql://root:testpass123@localhost:13306/testdb" \
    PG_TEST_URI="postgresql://postgres:testpass123@localhost:15432/testdb" \
    REDIS_TEST_URI="redis://localhost:16379/0" \
    python3 -m pytest tests-p/integration/TestRansom*.py -v --timeout=30
    ;;

  test-c2)
    echo -e "${BOLD}Building and testing C2 agent...${RESET}"
    $COMPOSE_TEST run --rm test-c2
    ;;

  test-ransom)
    echo -e "${BOLD}Building and testing Ransom locker...${RESET}"
    $COMPOSE_TEST run --rm test-ransom
    ;;

  down)
    echo -e "${BOLD}Stopping all containers...${RESET}"
    $COMPOSE down 2>/dev/null || true
    $COMPOSE_TEST down 2>/dev/null || true
    echo -e "${GREEN}Done.${RESET}"
    ;;

  clean)
    echo -e "${RED}Removing all containers, volumes, and images...${RESET}"
    $COMPOSE down -v --rmi local 2>/dev/null || true
    $COMPOSE_TEST down -v --rmi local 2>/dev/null || true
    docker rm -f test-mongo test-mysql test-postgres test-redis 2>/dev/null || true
    echo -e "${GREEN}Clean.${RESET}"
    ;;

  status)
    echo -e "${BOLD}Container Status:${RESET}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "attackmenu|test-|NAME"
    ;;

  logs)
    $COMPOSE logs -f py-server rb-server
    ;;

  *)
    echo -e "${BOLD}AttackMenu Docker Manager${RESET}"
    echo ""
    echo "  Usage: $0 <command>"
    echo ""
    echo "  Commands:"
    echo "    build       Build all Docker images"
    echo "    up          Start py-server + rb-server"
    echo "    cli         Run CLI interactively"
    echo "    test        Run ALL tests (TS + Python + Ruby + C)"
    echo "    test-db     Run only database integration tests"
    echo "    test-c2     Compile + test C2 agent in Wine"
    echo "    test-ransom Compile + test Ransom locker on Linux"
    echo "    down        Stop all containers"
    echo "    clean       Remove containers, volumes, images"
    echo "    status      Show container status"
    echo "    logs        Tail server logs"
    ;;
esac
