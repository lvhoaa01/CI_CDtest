# CI/CD Task Board

Một project nhỏ nhưng đi hết vòng đời từ source code đến container production. Ứng dụng là Task Board có Node.js REST API, giao diện web, unit/integration test, Docker image, health check, GitHub Actions và rollback.

> Trạng thái local sau khi setup: ứng dụng chạy tại `http://localhost:3000`. Dữ liệu task chỉ nằm trong memory để demo tập trung vào CI/CD và sẽ mất khi container được tạo lại.

```text
Pull request / push
        |
        v
Lint -> Test -> Build artifact -> Build container -> Smoke test
                                                    |
                                    push main       v
                                          GitHub Container Registry
                                                    |
                                      DEPLOY_ENABLED=true
                                                    v
                                       Docker host -> Health check
                                                    |
                                          failure -> Rollback
```

## Chạy local bằng Node.js

Yêu cầu Node.js 22 trở lên.

```bash
npm ci
npm run lint
npm test
npm run build
npm start
```

Mở `http://localhost:3000`. Health endpoint là `http://localhost:3000/health`.

Chế độ phát triển tự khởi động lại khi sửa source:

```bash
npm run dev
```

## Chạy bằng Docker

```bash
docker compose up --build --wait
curl http://localhost:3000/health
docker compose down
```

Image có thể được build riêng với danh tính release:

```bash
docker build \
  --build-arg APP_VERSION=1.0.0 \
  --build-arg COMMIT_SHA=abc123 \
  -t ci-cd-task-board:1.0.0 .
```

PowerShell dùng dấu backtick thay cho dấu `\` để xuống dòng, hoặc đặt toàn bộ lệnh trên một dòng.

## Pipeline làm gì?

Workflow nằm tại `.github/workflows/pipeline.yml`.

### Pull request

1. Cài đúng dependencies từ `package-lock.json`.
2. Audit production dependencies.
3. Lint source code.
4. Chạy test và thu coverage.
5. Tạo artifact `dist/`.
6. Build Docker image.
7. Khởi chạy container và gọi `/health`.
8. Không publish và không deploy.

### Push vào `main`

Pipeline chạy lại toàn bộ quality gate, sau đó:

1. Push image bất biến `ghcr.io/<owner>/<repo>:sha-<commit>`.
2. Cập nhật tag tiện dụng `latest`.
3. Nếu repository variable `DEPLOY_ENABLED=true`, deploy đúng image SHA lên Docker host.
4. Docker Compose đợi health check thành công.
5. Nếu container mới không healthy, `deploy.sh` tự chạy lại image cũ.

Tag SHA là nguồn sự thật khi deploy và rollback; `latest` chỉ dành cho thao tác thuận tiện.

## Bật CD lên một server

Server Linux cần Docker Engine, Docker Compose plugin và một thư mục người dùng deploy có quyền ghi, ví dụ `/opt/ci-cd-task-board`. Image GHCR cần được đặt public hoặc server phải đăng nhập GHCR trước.

Thiết lập GitHub repository variables:

| Variable | Ví dụ | Ý nghĩa |
|---|---|---|
| `DEPLOY_ENABLED` | `true` | Bật job deploy sau khi push `main` |
| `DEPLOY_HOST` | `demo.example.com` | IP hoặc hostname của server |
| `DEPLOY_USER` | `deployer` | Người dùng SSH có quyền chạy Docker |
| `DEPLOY_PATH` | `/opt/ci-cd-task-board` | Thư mục deploy đã tồn tại và có quyền ghi |
| `PRODUCTION_URL` | `https://demo.example.com` | URL public để smoke test lần cuối |

Thiết lập repository secret `DEPLOY_SSH_KEY` bằng private key dành riêng cho deploy. Public key tương ứng nằm trong `~/.ssh/authorized_keys` của `DEPLOY_USER`.

Nên tạo GitHub Environment tên `production`; có thể thêm reviewer bắt buộc nếu muốn Continuous Delivery thay vì tự động Continuous Deployment.

## Rollback thủ công

Trên server:

```bash
cd /opt/ci-cd-task-board
./rollback.sh
```

Hoặc deploy trực tiếp một image SHA đã biết:

```bash
./deploy.sh ghcr.io/owner/repo:sha-abc123 1.0.12 abc123
```

## Cấu trúc quan trọng

```text
src/                    Node.js API và nghiệp vụ
public/                 Sản phẩm giao diện người dùng
test/                   Unit và HTTP integration test
scripts/build.mjs       Tạo artifact dist/
Dockerfile              Công thức tạo image runtime
compose.yaml            Trạng thái container production
scripts/deploy.sh       Deploy và rollback tự động khi lỗi
.github/workflows/      Pipeline CI/CD
docs/ci-cd-guide.md     Bài học và bài thực hành
```

Đọc [docs/ci-cd-guide.md](docs/ci-cd-guide.md) để theo dõi từng bước từ một dòng code đến container production.
