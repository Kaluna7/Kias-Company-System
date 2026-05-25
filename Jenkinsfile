pipeline {
    agent any

    environment {
        OPENAI_API_KEY = credentials('openai-key')
    }

    stages {

        stage('Deploy') {
            steps {
                sh '''
                    echo "DEPLOY START"

                    # pastikan container lama berhenti
                    docker compose down

                    # build & run dengan env dari Jenkins
                    OPENAI_API_KEY=$OPENAI_API_KEY \
                    docker compose up -d --build
                '''
            }
        }
    }
}