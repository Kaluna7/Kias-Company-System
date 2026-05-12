stage('Deploy') {
  steps {
    sh '''
      echo "DEPLOY START"

      cd /root/Kias-Company-System

      git pull origin main

      docker compose down --remove-orphans

      docker compose up -d --build
    '''
  }
}