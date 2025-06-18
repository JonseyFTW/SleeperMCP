# Deployment Guide for Sleeper MCP Server

## 🚀 Railway Deployment (Recommended)

Railway provides the easiest deployment experience with managed databases and automatic deployments.

### **Step 1: Prepare Your Repository**

1. **Push to GitHub** (if not already done):
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

2. **Environment Variables** - Railway will need these:
```env
NODE_ENV=production
PORT=8080
CORS_ORIGIN=*

# Railway will provide database URLs automatically
POSTGRES_HOST=${PGHOST}
POSTGRES_PORT=${PGPORT}  
POSTGRES_DB=${PGDATABASE}
POSTGRES_USER=${PGUSER}
POSTGRES_PASSWORD=${PGPASSWORD}

REDIS_HOST=${REDISHOST}
REDIS_PORT=${REDISPORT}
REDIS_PASSWORD=${REDISPASSWORD}

# Analytics configuration
LOG_LEVEL=info
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
SLEEPER_API_TIMEOUT=30000
RATE_LIMIT_MAX_REQUESTS=10000
```

### **Step 2: Deploy to Railway**

1. **Sign up** at [railway.app](https://railway.app)

2. **Create New Project** from GitHub repository

3. **Add Services**:
   - **PostgreSQL**: Click "Add Service" → Database → PostgreSQL
   - **Redis**: Click "Add Service" → Database → Redis
   - **Web Service**: Your main application (auto-detected)

4. **Configure Environment Variables**:
   ```bash
   # Railway auto-provides database variables, just add these:
   NODE_ENV=production
   LOG_LEVEL=info
   RATE_LIMIT_MAX_REQUESTS=10000
   ```

5. **Deploy**: Railway automatically deploys from your `main` branch

### **Step 3: Initial Data Setup**

After deployment, run initial setup:

```bash
# Use Railway CLI or the web dashboard
railway run npm run analytics:setup
railway run npm run analytics:ingest
railway run npm run analytics:update
```

### **Step 4: Set Up Nightly Jobs**

Railway supports cron jobs natively:

1. **Add Cron Service** in Railway dashboard
2. **Set schedule**: `0 6 * * *` (6 AM daily)
3. **Command**: `npm run analytics:nightly-delta`

**Total Railway Cost: ~$25-40/month**

---

## 🔄 Alternative: Render Deployment

### **Step 1: Prepare for Render**

1. **Create render.yaml**:
```yaml
databases:
  - name: sleeper-postgres
    databaseName: sleeper_analytics
    user: sleeper
    plan: starter

  - name: sleeper-redis
    plan: starter

services:
  - type: web
    name: sleeper-mcp
    plan: starter
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: POSTGRES_HOST
        fromDatabase:
          name: sleeper-postgres
          property: host
      - key: POSTGRES_PORT
        fromDatabase:
          name: sleeper-postgres
          property: port
      - key: POSTGRES_DB
        fromDatabase:
          name: sleeper-postgres  
          property: database
      - key: POSTGRES_USER
        fromDatabase:
          name: sleeper-postgres
          property: user
      - key: POSTGRES_PASSWORD
        fromDatabase:
          name: sleeper-postgres
          property: password
      - key: REDIS_HOST
        fromDatabase:
          name: sleeper-redis
          property: host
      - key: REDIS_PORT
        fromDatabase:
          name: sleeper-redis
          property: port

  - type: cron
    name: nightly-sync
    schedule: "0 6 * * *"
    buildCommand: npm install
    startCommand: npm run analytics:nightly-delta
```

2. **Deploy** at [render.com](https://render.com)

**Total Render Cost: ~$21/month**

---

## ⚡ Alternative: Fly.io Deployment

### **Step 1: Install Fly CLI**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

### **Step 2: Initialize Fly App**
```bash
# Initialize app
fly launch --generate-name

# Add PostgreSQL
fly postgres create --name sleeper-postgres

# Add Redis
fly redis create --name sleeper-redis

# Connect databases
fly postgres attach sleeper-postgres
fly redis attach sleeper-redis
```

### **Step 3: Configure fly.toml**
```toml
app = "your-app-name"
primary_region = "dfw"

[build]
  dockerfile = "Dockerfile.production"

[[services]]
  http_checks = []
  internal_port = 8080
  processes = ["app"]
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

[[services.tcp_checks]]
  grace_period = "1s"
  interval = "15s"
  restart_limit = 0
  timeout = "2s"

[env]
  NODE_ENV = "production"
  PORT = "8080"
```

### **Step 4: Deploy**
```bash
fly deploy
```

**Total Fly.io Cost: ~$20/month**

---

## 🌐 Setting Up Custom Domain (Optional)

### **Railway**:
1. Go to project settings
2. Add custom domain
3. Update DNS CNAME record

### **Render**:
1. Go to service settings  
2. Add custom domain
3. Update DNS records as shown

### **Fly.io**:
```bash
fly certs create yourdomain.com
```

---

## 📊 Monitoring & Alerts

### **Health Checks**
All platforms support health checks via `/health` endpoint.

### **Logging**
- **Railway**: Built-in logs dashboard
- **Render**: Integrated logging
- **Fly.io**: `fly logs` command

### **Uptime Monitoring**
Set up external monitoring:
- [UptimeRobot](https://uptimerobot.com) (free)
- [Pingdom](https://pingdom.com)
- [Better Uptime](https://betteruptime.com)

---

## 🔒 Security Considerations

### **Environment Variables**
Never commit sensitive data. Use platform-provided variable management.

### **API Rate Limiting**
Configure appropriate rate limits:
```env
RATE_LIMIT_MAX_REQUESTS=10000  # Adjust based on expected usage
RATE_LIMIT_WINDOW_MS=60000     # 1 minute window
```

### **CORS Configuration**
For public API access:
```env
CORS_ORIGIN=*  # Allow all origins (for public MCP server)
# Or restrict to specific domains:
CORS_ORIGIN=https://yourdomain.com,https://claude.ai
```

### **Database Security**
All recommended platforms provide:
- Encrypted connections (SSL/TLS)
- VPC/private networking
- Automated backups
- Access logging

---

## 🚀 Going Live Checklist

### **Pre-Launch**
- [ ] Repository pushed to GitHub
- [ ] Environment variables configured
- [ ] Database schema initialized
- [ ] Historical data ingested
- [ ] Health checks passing
- [ ] Nightly sync scheduled

### **Post-Launch**
- [ ] Domain configured (if using custom domain)
- [ ] Monitoring set up
- [ ] Backup strategy confirmed
- [ ] Documentation updated with API endpoint
- [ ] Usage analytics configured

### **Share Your MCP Server**
Once deployed, share your API endpoint:
```
https://your-app.railway.app/rpc
```

Users can connect their LLM tools to this endpoint to access your analytics data!

---

## 💰 Cost Comparison Summary

| Platform | Monthly Cost | Setup Difficulty | Features |
|----------|-------------|------------------|----------|
| **Railway** | $25-40 | ⭐ Very Easy | Managed DB + Cron |
| **Render** | $21 | ⭐⭐ Easy | Managed DB + Cron |
| **Fly.io** | $20 | ⭐⭐⭐ Moderate | Full Control |

**Railway is recommended** for the best balance of ease, features, and cost for your MCP server hosting needs.