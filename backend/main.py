from flask import Flask
from flask_cors import CORS
from config import validate_config
from routes import bp

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    app.register_blueprint(bp)
    return app

if __name__ == "__main__":
    validate_config()
    app = create_app()
    print("✅ Walmart Health backend running at http://localhost:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)