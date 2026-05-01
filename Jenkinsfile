pipeline {
    agent any

    tools {
        nodejs 'Node20'
    }

    environment {
        APP_PORT = '5000'
        APP_NAME = 'Eventory'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=========================================='
                echo "  Build #${env.BUILD_NUMBER} for ${env.APP_NAME}"
                echo '=========================================='
                echo "Pulling latest code from GitHub..."
                checkout scm
                echo 'Checkout complete.'
            }
        }

        stage('Show Latest Commit') {
            steps {
                bat '''
                    echo === LATEST COMMIT INFO ===
                    git log -1 --pretty=format:"Commit:  %%H%%nAuthor:  %%an%%nDate:    %%ad%%nMessage: %%s"
                    echo.
                '''
            }
        }

        stage('Verify Environment') {
            steps {
                echo 'Checking Node.js and npm versions...'
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing project dependencies (npm install)...'
                bat 'npm install --no-audit --no-fund'
                echo 'Dependencies installed successfully.'
            }
        }

        stage('Stop Old Server') {
            steps {
                echo "Stopping any old server on port 5000..."
                bat """
                    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
                        echo Killing PID %%a
                        taskkill /F /PID %%a 2^>nul
                    )
                    echo Old server stopped (if any was running).
                    exit /b 0
                """
            }
        }

        stage('Copy Credentials') {
            steps {
                echo 'Copying serviceAccountKey.json from secure location...'
                bat """
                    if exist "C:\\jenkins-secrets\\serviceAccountKey.json" (
                        copy /Y "C:\\jenkins-secrets\\serviceAccountKey.json" "%WORKSPACE%\\serviceAccountKey.json"
                        echo Credentials copied successfully.
                    ) else (
                        echo WARNING: No serviceAccountKey.json found at C:\\jenkins-secrets\\
                    )
                    exit /b 0
                """
            }
        }

        stage('Deploy Server') {
            steps {
                echo 'Starting Eventory server in background...'
                bat """
                    start /B cmd /c "node server.js > server.log 2>&1"
                    echo Waiting 6 seconds for server to boot...
                    timeout /t 6 /nobreak > nul
                    exit /b 0
                """
            }
        }

        stage('Health Check') {
            steps {
                echo "Verifying server is responding on http://localhost:5000/health ..."
                bat """
                    curl -f -s http://localhost:5000/health
                    if %ERRORLEVEL% NEQ 0 (
                        echo HEALTH CHECK FAILED!
                        echo --- server.log tail ---
                        type server.log
                        exit /b 1
                    )
                    echo.
                    echo Health check passed.
                """
            }
        }
    }

    post {
        success {
            echo '=========================================='
            echo "  BUILD #${env.BUILD_NUMBER} SUCCEEDED"
            echo "  Eventory is live at http://localhost:5000/"
            echo '=========================================='
        }
        failure {
            echo '=========================================='
            echo "  BUILD #${env.BUILD_NUMBER} FAILED"
            echo '  Check the console output above for details.'
            echo '=========================================='
        }
        always {
            echo "Build duration: ${currentBuild.durationString}"
        }
    }
}