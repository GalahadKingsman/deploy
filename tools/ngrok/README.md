# ngrok Setup for Telegram Mini App Development

## Installation

### macOS (Homebrew)

```bash
brew install ngrok/ngrok/ngrok
```

### Other platforms

Download from [ngrok.com](https://ngrok.com/download)

## Authentication

1. Sign up at [ngrok.com](https://ngrok.com) (free account is enough)
2. Get your authtoken from [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

## Usage

### Start tunnel for webapp

Webapp runs on port `5173` by default:

```bash
ngrok http 5173
```

### Get public URL

After starting ngrok, you'll see:

1. **Web UI**: Open http://127.0.0.1:4040 in browser
   - Click on the tunnel to see details
   - Copy the `Forwarding` URL (e.g., `https://xxxx.ngrok-free.app`)

2. **Command line**: ngrok prints the URL in stdout:
   ```
   Forwarding   https://xxxx.ngrok-free.app -> http://localhost:5173
   ```

### Example config (optional)

Create `~/.ngrok2/ngrok.yml`:

```yaml
version: '2'
authtoken: YOUR_AUTHTOKEN
tunnels:
  webapp:
    addr: 5173
    proto: http
```

Then run: `ngrok start webapp`

## Troubleshooting

- **"authtoken missing"**: Run `ngrok config add-authtoken YOUR_TOKEN`
- **"port already in use"**: Check if webapp is running on port 5173
- **"invalid host header"**: This is normal for ngrok, webapp should handle it
