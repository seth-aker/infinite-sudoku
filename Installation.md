# How to Contribute

# For the backend and frontend web app
1. Pull repo from git
`git pull origin main`
2. Build frontend and backend
`cd /frontend && pnpm build`
`cd ../backend && pnpm build`
3. Build and run docker containers
`sudo docker compose up -d --build`

## For the mobile app
1. Install dependencies via fvm
`cd app/ && fvm flutter pub get`
2. Run build_runner to generate json annotation files.
`fvm dart run build_runner build`
3. Run app in debug mode
`fvm flutter run`
