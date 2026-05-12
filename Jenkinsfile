pipeline {
    agent any

    stages {
        stage('Deploy') {
            steps {
                sh '''
                    echo "DEPLOY START"
                    docker compose down
                    docker compose up -d --build
                '''
            }
        }
    }
}