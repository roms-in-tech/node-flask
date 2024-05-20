pipeline {
    agent any

    environment {
        NODE_HOME = tool name: 'NodeJS 14', type: 'NodeJS' // Adjust the NodeJS version as per your setup
        PATH = "${NODE_HOME}/bin:${env.PATH}"
        PYTHON_ENV = "${env.WORKSPACE}/venv"
    }

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/roms-in-tech/node-flask.git'
            }
        }
        
        stage('Install Dependencies') {
            parallel {
                stage('Install Node.js Dependencies') {
                    steps {
                        dir('node_app') {
                            sh 'npm install'
                        }
                    }
                }
                stage('Install Python Dependencies') {
                    steps {
                        dir('flask_app') {
                            sh 'python -m venv venv'
                            sh './venv/bin/pip install -r requirements.txt'
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Test Node.js Application') {
                    steps {
                        dir('node_app') {
                            sh 'npm test'
                        }
                    }
                }
                // Add Python Flask tests if available
                stage('Test Python Flask Application') {
                    steps {
                        dir('flask_app') {
                            // Add your Python test command here
                            // sh './venv/bin/pytest'
                        }
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                echo 'Building...'
                // Add build steps if needed
            }
        }
        
        stage('Deploy') {
            steps {
                echo 'Deploying...'
                // Add deploy steps here, e.g., starting your applications
                dir('node_app') {
                    sh 'nohup npm start &'  // This is a simple example, adjust according to your setup
                }
                dir('flask_app') {
                    sh 'nohup ./venv/bin/python app.py &'  // This is a simple example, adjust according to your setup
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
