-- MySQL init script para testes de criptografia Ransom
-- Cria tabelas com dados realistas para testar o fluxo completo

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product VARCHAR(128) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secrets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(64) NOT NULL,
    key_value TEXT NOT NULL,
    category VARCHAR(32) DEFAULT 'api'
);

-- Seed data — 50 users
INSERT INTO users (username, email, password_hash) VALUES
('alice', 'alice@corp.com', 'bcrypt:$2b$12$LJ3m4ks...hashed1'),
('bob', 'bob@corp.com', 'bcrypt:$2b$12$8Kp2m...hashed2'),
('carol', 'carol@corp.com', 'bcrypt:$2b$12$Xn7p...hashed3'),
('dave', 'dave@corp.com', 'bcrypt:$2b$12$Ym9...hashed4'),
('eve', 'eve@corp.com', 'bcrypt:$2b$12$Qw3...hashed5'),
('frank', 'frank@corp.com', 'bcrypt:$2b$12$Rt7...hashed6'),
('grace', 'grace@corp.com', 'bcrypt:$2b$12$Uv2...hashed7'),
('heidi', 'heidi@corp.com', 'bcrypt:$2b$12$Wx5...hashed8'),
('ivan', 'ivan@corp.com', 'bcrypt:$2b$12$Zy8...hashed9'),
('judy', 'judy@corp.com', 'bcrypt:$2b$12$Ab1...hashed10');

-- Seed data — 20 orders
INSERT INTO orders (user_id, product, price, address, phone) VALUES
(1, 'Laptop Dell XPS 15', 1299.99, '123 Main St, New York, NY 10001', '+1-555-0101'),
(2, 'iPhone 15 Pro', 999.00, '456 Oak Ave, Los Angeles, CA 90001', '+1-555-0102'),
(3, 'Samsung Galaxy S24', 799.99, '789 Pine Rd, Chicago, IL 60601', '+1-555-0103'),
(1, 'AirPods Pro', 249.00, '123 Main St, New York, NY 10001', '+1-555-0101'),
(4, 'MacBook Pro M3', 2499.00, '321 Elm Blvd, Houston, TX 77001', '+1-555-0104'),
(5, 'Pixel 9', 699.00, '654 Cedar Ln, Phoenix, AZ 85001', '+1-555-0105'),
(6, 'Surface Pro 10', 1199.00, '987 Birch Dr, Philadelphia, PA 19101', '+1-555-0106'),
(7, 'iPad Air', 599.00, '147 Maple Ct, San Antonio, TX 78201', '+1-555-0107'),
(8, 'ThinkPad X1', 1449.00, '258 Walnut Way, San Diego, CA 92101', '+1-555-0108'),
(9, 'Galaxy Tab S9', 849.00, '369 Cherry Pl, Dallas, TX 75201', '+1-555-0109');

-- Seed data — API secrets
INSERT INTO secrets (key_name, key_value, category) VALUES
('STRIPE_API_KEY', 'sk_live_51Hb2kL...sensitive_key_1', 'payment'),
('AWS_ACCESS_KEY', 'AKIAIOSFODNN7EXAMPLE', 'cloud'),
('AWS_SECRET_KEY', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 'cloud'),
('SENDGRID_KEY', 'SG.XXXX.YYYY', 'email'),
('TWILIO_SID', 'AC1234567890abcdef', 'sms'),
('DATABASE_URL', 'postgresql://admin:secret@prod-db:5432/app', 'infra'),
('REDIS_URL', 'redis://:password@cache:6379/0', 'infra'),
('JWT_SECRET', 'super-secret-jwt-signing-key-256bit', 'auth'),
('GITHUB_TOKEN', 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'scm'),
('SLACK_WEBHOOK', 'https://hooks.slack.com/services/T00/B00/XXXX', 'notify');
