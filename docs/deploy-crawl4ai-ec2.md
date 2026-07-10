# Deploy Crawl4AI on AWS EC2 (Step-by-Step)

This guide deploys the Crawl4AI web UI on an EC2 instance in your existing AWS account (`274955213317`, region `us-east-1`).

Once deployed you'll have a browser-accessible crawl management UI at `http://<ec2-ip>:11235` for interactive scraping, schema testing, and prototyping new sources.

---

## Prerequisites

- AWS CLI configured (already done — using root credentials in `us-east-1`)
- Existing key pair: `qdrant` (reuse for SSH access)
- Existing VPC: `vpc-0272980b7e940ee7e`

---

## Step 1: Create a Security Group for Crawl4AI

```bash
aws ec2 create-security-group \
  --group-name crawl4ai-sg \
  --description "Crawl4AI web UI - ports 22, 11235" \
  --vpc-id vpc-0272980b7e940ee7e
```

Note the `GroupId` from the output (e.g., `sg-xxxxxxxxx`).

Open SSH (port 22) and Crawl4AI UI (port 11235):

```bash
# Replace sg-xxxxxxxxx with the GroupId from above
SG_ID=sg-xxxxxxxxx

# SSH access (restrict to your IP for security)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# Crawl4AI web UI
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 11235 \
  --cidr 0.0.0.0/0
```

> **Tip:** Replace `0.0.0.0/0` with your IP (`curl ifconfig.me`/32) for tighter security.

---

## Step 2: Launch the EC2 Instance

```bash
aws ec2 run-instances \
  --image-id ami-0d28727121d5d4a3c \
  --instance-type t3.medium \
  --key-name qdrant \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=crawl4ai-server}]' \
  --count 1
```

**Why `t3.medium`?**
- 2 vCPU, 4 GB RAM — minimum for headless Chromium
- 30 GB gp3 disk — Docker images + browser cache
- AMI: Ubuntu 22.04 (Canonical official)

Wait for it to start:

```bash
# Get instance ID from the run-instances output, then:
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=crawl4ai-server" \
  --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress,State.Name]' \
  --output table
```

---

## Step 3: SSH into the Instance

```bash
ssh -i ~/.ssh/qdrant.pem ubuntu@<PUBLIC_IP>
```

> If your key is at a different path, adjust accordingly. First-time connect will ask to accept the fingerprint — type `yes`.

---

## Step 4: Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-v2

# Start and enable Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add ubuntu user to docker group (avoids sudo for docker commands)
sudo usermod -aG docker ubuntu

# Apply group change (or logout and back in)
newgrp docker
```

Verify:

```bash
docker --version
# Docker version 24.x or later
```

---

## Step 5: Deploy Crawl4AI

### Option A: Simple `docker run`

```bash
docker run -d \
  --name crawl4ai \
  --restart unless-stopped \
  -p 11235:11235 \
  -e CRAWL4AI_API_TOKEN=your-secret-token-here \
  unclecode/crawl4ai
```

### Option B: Docker Compose (recommended for persistence)

```bash
mkdir -p ~/crawl4ai && cd ~/crawl4ai
```

Create `docker-compose.yml`:

```bash
cat > docker-compose.yml << 'EOF'
services:
  crawl4ai:
    image: unclecode/crawl4ai
    container_name: crawl4ai
    restart: unless-stopped
    ports:
      - "11235:11235"
    environment:
      - CRAWL4AI_API_TOKEN=your-secret-token-here
      - MAX_CONCURRENT_TASKS=5
    volumes:
      - crawl4ai-data:/app/data
    deploy:
      resources:
        limits:
          memory: 3G

volumes:
  crawl4ai-data:
EOF
```

Start it:

```bash
docker compose up -d
```

Check logs:

```bash
docker compose logs -f
# Wait until you see "Uvicorn running on http://0.0.0.0:11235"
```

---

## Step 6: Access the UI

Open in your browser:

```
http://<EC2_PUBLIC_IP>:11235
```

You should see the Crawl4AI web interface. Use the API token you set in `CRAWL4AI_API_TOKEN` if prompted.

---

## Step 7: Verify with a Test Crawl

From the UI or via curl from your local machine:

```bash
curl -X POST http://<EC2_PUBLIC_IP>:11235/crawl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token-here" \
  -d '{
    "urls": ["https://mofa.gov.np/category/information/"],
    "priority": 5
  }'
```

---

## Step 8: (Optional) Connect from Your AI Service

If you want your `apps/ai` scraper to use the remote Crawl4AI API instead of running Playwright locally, add to `apps/ai/.env`:

```env
CRAWL4AI_API_URL=http://<EC2_PUBLIC_IP>:11235
CRAWL4AI_API_TOKEN=your-secret-token-here
```

> **Note:** Your current `apps/ai/app/scraper.py` uses `AsyncWebCrawler` in-process. To use the remote API instead, you'd switch to Crawl4AI's REST client. For now, the UI is primarily useful for interactive exploration and testing new source schemas.

---

## Management Commands

```bash
# SSH into the instance
ssh -i ~/.ssh/qdrant.pem ubuntu@<PUBLIC_IP>

# View logs
docker compose logs -f crawl4ai

# Restart
docker compose restart crawl4ai

# Update to latest version
docker compose pull && docker compose up -d

# Stop
docker compose down
```

---

## Cost Estimate

| Resource | Monthly Cost (approx) |
|----------|----------------------|
| t3.medium (on-demand, 24/7) | ~$30 |
| 30 GB gp3 EBS | ~$2.40 |
| Data transfer (light use) | ~$1-2 |
| **Total** | **~$33-35/month** |

> **Cost saving:** If you only use it during work hours, stop the instance at night:
> ```bash
> # Stop (from local machine)
> aws ec2 stop-instances --instance-ids <INSTANCE_ID>
>
> # Start when needed
> aws ec2 start-instances --instance-ids <INSTANCE_ID>
> ```
> This cuts the cost to ~$10-12/month. Note: the public IP changes on restart unless you assign an Elastic IP ($3.65/month if attached to a running instance, free if the instance is stopped — actually $3.65/month if NOT attached).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Can't access UI in browser | Check security group has port 11235 open; verify instance is running |
| Docker pull fails | `sudo systemctl restart docker` or check disk space (`df -h`) |
| Out of memory errors | Upgrade to `t3.large` (8 GB) or reduce `MAX_CONCURRENT_TASKS` |
| Container keeps restarting | `docker logs crawl4ai` — usually a port conflict or OOM |
| SSH timeout | Security group must allow port 22 from your IP |

---

## Quick Reference (All Commands in Order)

```bash
# 1. Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name crawl4ai-sg \
  --description "Crawl4AI web UI" \
  --vpc-id vpc-0272980b7e940ee7e \
  --query 'GroupId' --output text)

# 2. Open ports
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 11235 --cidr 0.0.0.0/0

# 3. Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0d28727121d5d4a3c \
  --instance-type t3.medium \
  --key-name qdrant \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=crawl4ai-server}]' \
  --query 'Instances[0].InstanceId' --output text)

# 4. Wait and get IP
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "SSH: ssh -i ~/.ssh/qdrant.pem ubuntu@$PUBLIC_IP"
echo "UI:  http://$PUBLIC_IP:11235"

# 5. SSH and setup (run on the EC2 instance)
# ssh -i ~/.ssh/qdrant.pem ubuntu@$PUBLIC_IP
# Then run Steps 4 and 5 from above
```
