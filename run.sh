#!/bin/bash

# Script to run the app


case "$1" in
	network)
		echo "Starting network service..."
		# Add your network service start command here
		;;
	backend)
		echo "Starting backend service..."
		if [ -f backend/package.json ]; then
			cd backend
			npm install
			npm start
			cd ..
		else
			echo "No backend/package.json found. Please add your backend start command."
		fi
		;;
	frontend|front-end)
		echo "Starting front-end service..."
		if [ -f frontend/package.json ]; then
			cd frontend
			npm install
			npm start
			cd ..
		else
			echo "No frontend/package.json found. Please add your front-end start command."
		fi
		;;
	*)
		if [ -f package.json ]; then
			echo "Starting Node.js app with npm start..."
			npm install
			npm start
		else
			echo "No package.json found. Please add your app start command here."
		fi
		;;
esac
