# Từ code đến sản phẩm: hướng dẫn CI/CD của project

## 1. Bốn vật thể khác nhau

Project này cố ý tách bốn khái niệm thường bị gọi chung là “bản build”:

| Vật thể | Nằm ở đâu | Có ý nghĩa gì? |
|---|---|---|
| Source code | Git repository | Thứ lập trình viên sửa |
| Build artifact | `dist/` và GitHub Actions artifact | Source đã được chuẩn bị để chạy |
| Docker image | Local Docker hoặc GHCR | Artifact cộng runtime Node.js, có danh tính bất biến |
| Container | Docker host | Một tiến trình đang chạy từ image |

`Dockerfile` là công thức, image là gói đã đóng, container là một lần chạy của gói đó.

## 2. CI bảo vệ nhánh chính

Job `quality` và `container` là CI. Chúng trả lời các câu hỏi theo thứ tự:

1. Có cài lại project chính xác từ lock file được không?
2. Code có vi phạm quy tắc không?
3. Hành vi nghiệp vụ và HTTP API còn đúng không?
4. Có tạo được artifact không?
5. Có build được image không?
6. Container thật có khởi động và trả lời `/health` không?

Coverage cũng là quality gate thực sự: tối thiểu 80% line, 60% branch và 80% function. Nếu thấp hơn, lệnh test trả mã lỗi và pipeline dừng.

Chỉ kiểm tra unit test là chưa đủ: Dockerfile sai vẫn có thể khiến production chết. Vì vậy pipeline chạy một smoke test trên image thật.

Trong GitHub, bật branch protection cho `main` và yêu cầu hai status checks:

- `CI - lint, test and build`
- `CI - container and smoke test`

Khi đó Pull Request đỏ không thể merge bằng luồng bình thường.

## 3. Artifact phải truy vết được

Pipeline dùng Git commit SHA trong ba nơi:

- metadata của build;
- label và biến môi trường của Docker image;
- tag image `sha-<commit>`.

Endpoint `/health` trả về version và commit. Khi xảy ra sự cố, ta có thể đi từ website đang chạy về đúng commit đã tạo ra nó.

Tag `latest` có thể thay đổi nên không được xem là danh tính release. CD deploy tag SHA cụ thể.

## 4. CD vận chuyển đúng thứ CI đã kiểm tra

Sau khi smoke test thành công, image đó được push lên GitHub Container Registry. Job deploy không build lại source trên server; server chỉ pull image đã qua CI.

Đây là nguyên tắc quan trọng:

```text
build once -> test it -> promote the same artifact
```

Nếu build lại ở từng môi trường, production có thể nhận dependency hoặc output khác thứ đã được kiểm thử.

## 5. Health check và rollback

Docker gọi `/health` định kỳ. `deploy.sh` dùng `docker compose up --wait`, nên deployment chỉ thành công khi container mới healthy.

Trước khi deploy, script ghi nhớ image hiện tại. Nếu image mới không healthy, script khởi chạy lại image cũ. Sau một deployment thành công, `.env.previous` cho phép chạy `rollback.sh` thủ công.

Demo này dùng recreate deployment, nên có thể gián đoạn ngắn. Hệ thống cần zero downtime thường đặt reverse proxy/load balancer trước nhiều replica và dùng rolling, blue-green hoặc canary deployment.

## 6. Continuous Delivery và Continuous Deployment

- **Continuous Delivery:** image luôn sẵn sàng để phát hành nhưng production có bước phê duyệt.
- **Continuous Deployment:** mọi thay đổi vượt qua quality gate được triển khai tự động.

GitHub Environment `production` có required reviewer sẽ biến job deploy thành Delivery. Bỏ approval sẽ là Deployment tự động.

## 7. Secrets và quyền hạn

Private key SSH nằm trong GitHub Secret, không nằm trong repository. Workflow khai báo permissions theo từng job:

- job đọc source chỉ có `contents: read`;
- chỉ job publish image có `packages: write`;
- job deploy không có quyền sửa repository hay package.

Image private yêu cầu Docker host đăng nhập GHCR bằng token chỉ có quyền đọc package. Không dùng Personal Access Token có quyền rộng nếu không cần.

## 8. Ba bài thực hành

### Bài 1: Nhìn CI chặn lỗi

Tạo branch, đổi một assertion trong `test/task-store.test.mjs` thành kết quả sai, push và mở Pull Request. Job test đỏ, artifact/image không được tạo. Sửa assertion và push lại; cùng PR chuyển xanh.

### Bài 2: Theo dấu một release

Merge PR vào `main`, mở workflow run và ghi lại commit SHA. Kiểm tra package trong GitHub Container Registry, rồi gọi:

```bash
curl https://your-domain.example/health
```

Giá trị `commit` phải trùng SHA của workflow.

### Bài 3: Quan sát rollback

Trên branch thử nghiệm, đổi health endpoint trả mã 500 hoặc làm server thoát khi khởi động. Build image với một tag thử nghiệm và chạy `deploy.sh`. Compose không đạt health check và script cố phục hồi image trước.

Không thử bài này trực tiếp trên hệ thống đang phục vụ dữ liệu quan trọng.

## 9. Những gì cố ý chưa có

Task được giữ trong memory và mất khi container restart. Đây là chủ ý để project tập trung vào pipeline. Khi thêm database, CI/CD cần thêm backup, migration tương thích ngược và chiến lược rollback dữ liệu.

Một hệ thống lớn hơn thường bổ sung:

- SAST, secret scan và container vulnerability scan;
- staging trước production;
- database migration;
- reverse proxy và HTTPS;
- metrics, log tập trung và alert;
- deployment nhiều replica hoặc Kubernetes;
- release notes và change approval.

Các thành phần đó giải quyết rủi ro cụ thể, không phải huy hiệu bắt buộc để một pipeline được gọi là CI/CD.
