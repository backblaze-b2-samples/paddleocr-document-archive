# Railway Deployment

Deploy both services (web + api) of **paddleocr-document-archive** on Railway.

## Setup

1. Create a new Railway project
2. Add two services from the same repo:

### Web Service (Next.js)
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Port**: `3000`

### API Service (FastAPI)
- **Root Directory**: `services/api`
- **Build Command**: `pip install -r requirements.txt && pip install -r requirements-ml.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

> The API image is **heavier** than a typical starter deploy because
> `requirements-ml.txt` installs PaddleOCR + PaddlePaddle. The first OCR request
> also downloads the models (~a few hundred MB) to `~/.paddleocr`; mount a
> persistent volume there if you want to avoid re-downloading on each cold start.
> Persist `services/api/data/` too if you want the SQLite search index to
> survive restarts (it is otherwise rebuildable from B2 via Reindex).

## Environment Variables

Set these on the API service (standardized `B2_*` names):

| Variable | Value |
|----------|-------|
| `B2_APPLICATION_KEY_ID` | Your B2 key ID |
| `B2_APPLICATION_KEY` | Your B2 application key |
| `B2_BUCKET_NAME` | Your bucket name |
| `B2_REGION` | Your bucket's region slug (e.g. `us-west-004`); the S3 endpoint is derived from it |
| `B2_PUBLIC_URL_BASE` | Optional public base URL for object links (leave blank to use presigned URLs only) |
| `API_CORS_ORIGINS` | Your web service URL (e.g., `https://web-production-xxx.up.railway.app`) |

Set this on the Web service:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your API service URL (e.g., `https://api-production-xxx.up.railway.app`) |
