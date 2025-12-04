---
description: Deploy the application to production
---

To deploy the latest changes to production, simply run the fast deployment script:

```bash
./deploy-prod.sh
```

This script will:
1. Check for uncommitted changes and ask to commit them.
2. Push your changes to the remote repository.
3. Connect to the server via SSH.
4. Trigger the deployment process on the server (pull, rebuild, restart).

// turbo
./deploy-prod.sh
