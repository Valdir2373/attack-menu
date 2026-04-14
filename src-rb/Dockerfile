FROM ruby:3.3-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock* /app/
RUN bundle install --without test

COPY . /app/

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE 4444

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD ruby -e "require 'net/http'; Net::HTTP.get(URI('http://localhost:4444/health'))" || exit 1

CMD ["bundle", "exec", "thin", "start", "-R", "config.ru", "-p", "4444", "-a", "0.0.0.0"]
