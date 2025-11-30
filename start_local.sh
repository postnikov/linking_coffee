#!/bin/bash

# Kill any existing processes on ports 3000 and 3001
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Start Backend
echo "🚀 Starting Backend on port 3001..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to initialize
sleep 2

# Start Frontend
echo "🎨 Starting Frontend on port 3000..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "✅ Local environment started!"
echo "🌍 Frontend: http://localhost:3000"
echo "⚙️  Backend: http://localhost:3001"
echo "Press CTRL+C to stop both servers."

# Handle script termination to kill child processes
trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

# Keep script running
wait
