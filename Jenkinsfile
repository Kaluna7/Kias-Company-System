pipeline {
    agent any

    environment {
        OPENAI_API_KEY = credentials('openai-key')
        COMPOSE_PROJECT_NAME = 'kias'
    }

    stages {

        stage('Deploy') {
            steps {
                sh '''
                    set -e
                    echo "DEPLOY START (compose project: ${COMPOSE_PROJECT_NAME})"

                    # Fixed container_name in compose — stop orphans from older Jenkins workspaces
                    for c in kias-app kias-onlyoffice minio_storage; do
                      docker rm -f "$c" 2>/dev/null || true
                    done

                    docker compose down --remove-orphans || true

                    OPENAI_API_KEY=$OPENAI_API_KEY \
                    docker compose up -d --build

                    docker compose ps
                    echo "DEPLOY DONE"
                '''
            }
        }
    }
}
