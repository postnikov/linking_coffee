# How to access Authentication Logs

The most reliable way to view the logs (bypasssing file permission issues) is directly through Docker:

```bash
# SSH into server
ssh root@91.98.235.147

# View real-time Auth logs (Filtered)
docker logs -f linking-coffee-backend 2>&1 | grep "\[AUTH\]"
```

## Alternative (Raw logs)
```bash
docker logs -f linking-coffee-backend
```
