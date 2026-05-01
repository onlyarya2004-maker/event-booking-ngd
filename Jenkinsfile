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
        stage('Checkout from GitHub') {
            steps {
                echo '=========================================='
                echo "  Build #${env.BUILD_NUMBER} for ${env.APP_NAME}"
                echo "  CI/CD Pipeline triggered"
                echo '=========================================='
                echo "Pulling latest code from GitHub repository..."
                checkout scm
                echo 'Code successfully fetched from GitHub.'
            }
        }

        stage('Show Latest Commit') {
            steps {
                echo 'Verifying which commit triggered this build...'
                bat '''
                    echo === LATEST COMMIT INFO ===
                    git log -1 --pretty=format:"Commit Hash: %%H%%nAuthor:      %%an%%nDate:        %%ad%%nMessage:     %%s"
                    echo.
                '''
            }
        }

        stage('Verify Build Environment') {
            steps {
                echo 'Checking Node.js and npm are available on this build agent...'
                bat 'node --version'
                bat 'npm --version'
                echo 'Build environment verified.'
            }
        }

        stage('Install Project Dependencies') {
            steps {
                echo 'Running npm install to fetch project dependencies...'
                bat 'npm install --no-audit --no-fund'
                echo 'All dependencies installed successfully.'
            }
        }

        stage('Sync Code to Deploy Folder') {
            steps {
                echo 'Syncing fresh code to the deployment folder...'
                bat """
                    echo Copying updated files from Jenkins workspace to deploy directory...
                    xcopy /Y /Q "%WORKSPACE%\\index.html" "C:\\Users\\Arya\\Desktop\\event-booking-system\\"
                    xcopy /Y /Q "%WORKSPACE%\\server.js" "C:\\Users\\Arya\\Desktop\\event-booking-system\\"
                    xcopy /Y /Q "%WORKSPACE%\\package.json" "C:\\Users\\Arya\\Desktop\\event-booking-system\\"
                    xcopy /Y /Q "%WORKSPACE%\\package-lock.json" "C:\\Users\\Arya\\Desktop\\event-booking-system\\"
                    if exist "%WORKSPACE%\\Jenkinsfile" xcopy /Y /Q "%WORKSPACE%\\Jenkinsfile" "C:\\Users\\Arya\\Desktop\\event-booking-system\\"
                    echo Files synced. The running server will pick up frontend changes immediately.
                """
            }
        }

        stage('Verify Deployed App') {
            steps {
                echo "Health-checking the running app on http://localhost:5000/health ..."
                bat """
                    curl -f -s http://localhost:5000/health
                    if %ERRORLEVEL% NEQ 0 (
                        echo HEALTH CHECK FAILED - is the server running?
                        echo Note: this build assumes the Eventory server is already running.
                        echo Start it manually with: node server.js
                        exit /b 1
                    )
                    echo.
                    echo Health check passed - app is responding.
                """
            }
        }
    }

    post {
        success {
            echo '=========================================='
            echo "  BUILD #${env.BUILD_NUMBER} SUCCEEDED"
            echo "  Code from GitHub deployed successfully."
            echo "  App is live at http://localhost:5000/"
            echo "  Frontend changes (index.html) are picked up immediately."
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