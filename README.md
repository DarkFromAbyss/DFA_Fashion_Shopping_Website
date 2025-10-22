Chạy website bằng Docker (PowerShell)

Yêu cầu
- Docker Desktop đã được cài và chạy
- Docker Compose (thường có sẵn cùng Docker Desktop)

Nhanh (copy/paste vào PowerShell)

```powershell
# Từ thư mục project
cd C:\Users\PC\Desktop\DFA_Fashion_Shopping_Website

# Khởi động Docker Desktop nếu chưa chạy (mở ứng dụng Docker Desktop từ Start Menu)

# Build và chạy các container ở chế độ nền
docker-compose up --build -d

# Kiểm tra trạng thái container
docker-compose ps

# Xem logs (theo dõi realtime)
docker-compose logs -f

# Dừng và xóa container (giữ volume dữ liệu)
docker-compose down

# Dừng và xóa container kèm volumes (xóa dữ liệu DB)
docker-compose down -v
```

Các bước chi tiết

1. Mở PowerShell và điều hướng đến thư mục chứa project:

```powershell
cd C:\Users\PC\Desktop\DFA_Fashion_Shopping_Website
```

2. Nếu Docker Desktop chưa chạy: mở ứng dụng Docker Desktop từ Start Menu và chờ cho đến khi Docker sẵn sàng.

3. Chạy lệnh sau để build image backend và khởi động các dịch vụ (Postgres + backend):

```powershell
docker-compose up --build -d
```

4. Kiểm tra các container đang chạy:

```powershell
docker-compose ps
```

5. Mở trình duyệt và truy cập:

http://localhost:3000

6. Khi cần debug, xem logs:

```powershell
docker-compose logs backend-app
docker-compose logs db
```

Xử lý sự cố thường gặp
- Lỗi kết nối tới Docker daemon (ví dụ: "unable to get image" hay pipe errors): đảm bảo Docker Desktop đang chạy và bạn đã đăng nhập nếu cần.
- Port 3000 hoặc 5432 đang bị chiếm: kiểm tra tiến trình cục bộ, hoặc sửa lại port mapping trong `docker-compose.yml`.
- Nếu muốn reset toàn bộ dữ liệu Postgres (sẽ xóa DB):

```powershell
docker-compose down -v
```

---

Local HTTPS and reverse-proxy (nginx) guide

This project includes an Express backend (`server.js`) that can run over HTTP or optionally HTTPS using self-signed certificates for local testing.

1) Local HTTPS (self-signed)

- Generate a self-signed certificate (OpenSSL required). From the project root (`d:\Hotel_Manager_Website\source`) run in PowerShell:

```powershell
# Create a certs folder
mkdir .\certs
cd .\certs
# Generate a private key
openssl genrsa -out key.pem 2048
# Generate a certificate (valid 365 days)
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/CN=localhost"
```

This creates `cert.pem` and `key.pem` in `./certs`.

- Start the server using HTTPS:

```powershell
# Enable HTTPS and redirection from HTTP to HTTPS
$env:USE_HTTPS = 'true'; $env:REDIRECT_TO_HTTPS = 'true'; npm start
```

Environment variables used by `server.js` for HTTPS:
- `USE_HTTPS=true` — enable HTTPS server
- `HTTPS_KEY_PATH` — path to private key (default: ./certs/key.pem)
- `HTTPS_CERT_PATH` — path to cert (default: ./certs/cert.pem)
- `HTTPS_PORT` — port for HTTPS (default: 3443)
- `REDIRECT_TO_HTTPS=true` — optional: run an HTTP redirector to HTTPS on `PORT` (default 3000)

Notes:
- Your browser will warn about the self-signed certificate; you can add a security exception for `localhost` for local testing.
- If using `docker compose` locally, you can mount your certs into the container and set the env vars in `docker-compose.yml`.

2) Production: nginx reverse-proxy recommendation

For production use a properly-signed certificate (Let's Encrypt or other CA) on the reverse proxy (nginx) and keep the backend running on a local HTTP port. Example nginx config:

```
server {
    listen 80;
    server_name example.com www.example.com;
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:3000; # backend listening locally
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Tips for production:
- Use Let's Encrypt certs (certbot) for free TLS certificates.
- Keep backend behind the reverse proxy; let nginx handle TLS termination.
- Consider enabling rate-limiting, IP whitelisting, and connection limits in nginx.
- Use process manager (pm2, systemd) to keep the Node server running.

